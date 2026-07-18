import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JudgeParticipation } from '../entities/judge-participation.entity';
import { JudgeProfile } from '../entities/judge-profile.entity';
import { CreateJudgeParticipationDto } from '../dto/create-judge-participation.dto';
import { UpdateJudgeParticipationDto } from '../dto/update-judge-participation.dto';
import { UpdateOwnJudgeDto } from '../dto/update-own-judge.dto';
import { EventsService } from '../../events/services/events.service';
import { UsersService } from '../../users/services/users.service';
import type { User } from '../../users/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { stripUndefined } from '../../common/utils/strip-undefined';

interface JudgeUserInfo {
  email: string;
  firstName: string;
  lastName: string;
}

export interface JudgeCatalogEntry {
  source: 'platform' | 'own';
  judgeId?: string;
  userId: string | null;
  name: string;
  email: string;
  usedByMe?: boolean;
}

// Espelha ProgramsService (apps/api/src/programs/services/programs.service.ts)
// aplicando o mesmo padrão de catálogo + dedup + merge automático pra
// jurados. Sem tela própria no frontend ainda — só a base no backend
// (mesmo estágio em que Program começou).
@Injectable()
export class JudgesService {
  constructor(
    @InjectRepository(JudgeParticipation)
    private readonly participationsRepo: Repository<JudgeParticipation>,
    @InjectRepository(JudgeProfile)
    private readonly profilesRepo: Repository<JudgeProfile>,
    private readonly eventsService: EventsService,
    private readonly usersService: UsersService,
  ) {}

  async create(
    eventId: string,
    dto: CreateJudgeParticipationDto,
    createdById: string,
  ): Promise<JudgeParticipation> {
    await this.eventsService.findEventOrThrow(eventId);
    let userId = dto.userId ?? null;
    let eligibleUser: User | null = null;
    if (userId) {
      await this.assertJudgeUser(userId);
    } else {
      // Nenhum userId veio do picker do catálogo — antes de criar uma
      // linha solta, confere se o email digitado já não é de uma conta
      // elegível (qualquer role menos PROGRAM) da plataforma, pra
      // vincular direto em vez de deixar uma entrada duplicada/órfã que
      // nunca vai se reclamar sozinha (o merge automático só roda no
      // set-password, e essa conta pode já ter passado por ali há
      // muito tempo).
      eligibleUser = await this.findEligibleJudgeUserByEmail(dto.email);
      userId = eligibleUser?.id ?? null;
    }
    await this.assertNoDuplicateInCatalog(createdById, dto.name, dto.email);
    if (userId) {
      // Semeia com o nome/email REAIS da conta (não o que o produtor
      // digitou) — mesma fonte de verdade usada em
      // linkUnclaimedJudgesByEmail, só cria se não existir ainda.
      await this.getOrCreateProfile(
        userId,
        eligibleUser
          ? {
              name: `${eligibleUser.firstName} ${eligibleUser.lastName}`,
              contactEmail: eligibleUser.email,
            }
          : undefined,
      );
    }
    const participation = this.participationsRepo.create({
      ...dto,
      userId,
      eventId,
      createdById,
    });
    const saved = await this.participationsRepo.save(participation);
    return this.toJudgeView(saved);
  }

  async findAllForEvent(eventId: string): Promise<JudgeParticipation[]> {
    await this.eventsService.findEventOrThrow(eventId);
    const participations = await this.participationsRepo.find({
      where: { eventId },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(participations.map((p) => this.toJudgeView(p)));
  }

  async findOneForEvent(
    eventId: string,
    id: string,
  ): Promise<JudgeParticipation> {
    const participation = await this.findJudgeOrThrow(eventId, id);
    return this.toJudgeView(participation);
  }

  // Organizador não pode mais editar nome/email de um jurado já
  // vinculado a uma conta própria (userId preenchido) — só o próprio
  // jurado edita, via updateOwnProfile. Mesma regra de ProgramsService.
  async update(
    eventId: string,
    id: string,
    dto: UpdateJudgeParticipationDto,
  ): Promise<JudgeParticipation> {
    const participation = await this.findJudgeOrThrow(eventId, id);
    if (participation.userId) {
      throw new ForbiddenException(
        'Este jurado já está vinculado a uma conta própria — os dados são editados pelo próprio jurado, não pelo organizador.',
      );
    }
    if (dto.userId) {
      await this.assertJudgeUser(dto.userId);
    }
    if (dto.name || dto.email) {
      await this.assertNoDuplicateInCatalog(
        participation.createdById,
        dto.name ?? participation.name,
        dto.email ?? participation.email,
        participation.id,
      );
    }
    Object.assign(participation, stripUndefined(dto));
    const saved = await this.participationsRepo.save(participation);
    return this.toJudgeView(saved);
  }

  async remove(eventId: string, id: string): Promise<void> {
    const participation = await this.findJudgeOrThrow(eventId, id);
    await this.participationsRepo.remove(participation);
  }

  // Usado por outros domínios (futuro) pra validar que o jurado existe
  // antes de operar sobre ele — mesmo papel de
  // ProgramsService.findProgramOrThrow. Retorna a linha crua (sem
  // overlay de JudgeProfile) — quem precisa da view de exibição chama
  // toJudgeView em seguida.
  async findJudgeOrThrow(
    eventId: string,
    id: string,
  ): Promise<JudgeParticipation> {
    const participation = await this.participationsRepo.findOneBy({
      id,
      eventId,
    });
    if (!participation) throw new NotFoundException('Jurado não encontrado');
    return participation;
  }

  // Qualquer usuário pode assumir o papel de jurado num evento, exceto
  // contas PROGRAM (a instituição/academia, não uma pessoa que julga).
  private async assertJudgeUser(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (user.role === UserRole.PROGRAM) {
      throw new ConflictException(
        'Uma conta do tipo Programa não pode ser jurado.',
      );
    }
  }

  private async findEligibleJudgeUserByEmail(
    email: string,
  ): Promise<User | null> {
    const user = await this.usersService.findByEmailInsensitive(email);
    if (!user || user.role === UserRole.PROGRAM) return null;
    return user;
  }

  // Impede um produtor de acumular duas entradas divergentes no
  // próprio catálogo (mesmo nome OU mesmo email, mas dados diferentes)
  // — reaproveitar o mesmo nome+email exatos (pra usar em outro
  // evento) continua permitido. Idêntico a
  // ProgramsService.assertNoDuplicateInCatalog.
  private async assertNoDuplicateInCatalog(
    createdById: string,
    name: string,
    email: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.participationsRepo
      .createQueryBuilder('participation')
      .where('participation.createdById = :createdById', { createdById })
      .andWhere(
        '(LOWER(participation.name) = LOWER(:name) OR LOWER(participation.email) = LOWER(:email))',
        { name, email },
      );
    if (excludeId) {
      qb.andWhere('participation.id != :excludeId', { excludeId });
    }
    const conflicting = await qb.getOne();
    if (!conflicting) return;

    const isExactMatch =
      conflicting.name.toLowerCase() === name.toLowerCase() &&
      conflicting.email.toLowerCase() === email.toLowerCase();
    if (isExactMatch) return;

    throw new ConflictException(
      'Você já tem um jurado com esse nome ou email cadastrado, com dados diferentes — reaproveite pelo catálogo em vez de cadastrar de novo.',
    );
  }

  // Vincula automaticamente ao usuário recém-registrado (role JUDGE)
  // toda JudgeParticipation que já existia (cadastrada manualmente por
  // algum organizador, userId ainda null) com o mesmo email — em
  // qualquer evento. Chamado por AuthService.setPassword. Também cria
  // o JudgeProfile canônico (se ainda não existir).
  async linkUnclaimedJudgesByEmail(
    userId: string,
    user: JudgeUserInfo,
  ): Promise<number> {
    const unclaimed = await this.participationsRepo
      .createQueryBuilder('participation')
      .where('LOWER(participation.email) = LOWER(:email)', {
        email: user.email,
      })
      .andWhere('participation.userId IS NULL')
      .getMany();

    if (unclaimed.length === 0) return 0;

    await this.getOrCreateProfile(userId, {
      name: `${user.firstName} ${user.lastName}`,
      contactEmail: user.email,
    });

    await this.participationsRepo
      .createQueryBuilder()
      .update(JudgeParticipation)
      .set({ userId })
      .where('id IN (:...ids)', { ids: unclaimed.map((p) => p.id) })
      .execute();

    return unclaimed.length;
  }

  // A partir daqui, endpoints de "judges/me" (JudgeProfileController).
  async findAllForUser(userId: string): Promise<{
    profile: JudgeProfile;
    events: Array<{ eventId: string; eventName?: string; startDate?: string }>;
  }> {
    const profile = await this.getOrCreateProfile(userId);
    const participations = await this.participationsRepo.find({
      where: { userId },
      relations: ['event'],
      order: { createdAt: 'DESC' },
    });
    return {
      profile,
      events: participations.map((p) => ({
        eventId: p.eventId,
        eventName: p.event?.name,
        startDate: p.event?.startDate,
      })),
    };
  }

  async updateOwnProfile(
    userId: string,
    dto: UpdateOwnJudgeDto,
  ): Promise<JudgeProfile> {
    const profile = await this.getOrCreateProfile(userId);
    Object.assign(profile, stripUndefined(dto));
    return this.profilesRepo.save(profile);
  }

  // Todo usuário da plataforma que não seja PROGRAM (qualquer um pode
  // ser jurado — não é restrito a contas role=JUDGE) + as entradas do
  // catálogo deste produtor que ainda não têm conta própria (senão já
  // apareceriam no primeiro grupo). Mesmo padrão de
  // ProgramsService.findCatalogForUser, mas sem restringir por role.
  async findCatalogForUser(createdById: string): Promise<JudgeCatalogEntry[]> {
    const judgeUsers = await this.usersService.findAllExceptRole(
      UserRole.PROGRAM,
    );
    const myParticipations = await this.participationsRepo.find({
      where: { createdById },
    });
    const myUserIds = new Set(
      myParticipations.filter((p) => p.userId).map((p) => p.userId as string),
    );

    const platformEntries: JudgeCatalogEntry[] = [];
    for (const user of judgeUsers) {
      const profile = await this.profilesRepo.findOneBy({ userId: user.id });
      platformEntries.push({
        source: 'platform',
        userId: user.id,
        name: profile?.name ?? `${user.firstName} ${user.lastName}`,
        email: profile?.contactEmail ?? user.email,
        usedByMe: myUserIds.has(user.id),
      });
    }

    const unclaimedOwnEntries: JudgeCatalogEntry[] = myParticipations
      .filter((p) => !p.userId)
      .map((p) => ({
        source: 'own',
        judgeId: p.id,
        userId: null,
        name: p.name,
        email: p.email,
      }));

    return [...platformEntries, ...unclaimedOwnEntries];
  }

  private async getOrCreateProfile(
    userId: string,
    seed?: { name: string; contactEmail: string },
  ): Promise<JudgeProfile> {
    const existing = await this.profilesRepo.findOneBy({ userId });
    if (existing) return existing;

    let initial = seed;
    if (!initial) {
      const user = await this.usersService.findById(userId);
      if (!user) throw new NotFoundException('Usuário não encontrado');
      initial = {
        name: `${user.firstName} ${user.lastName}`,
        contactEmail: user.email,
      };
    }
    const profile = this.profilesRepo.create({ userId, ...initial });
    return this.profilesRepo.save(profile);
  }

  // Aplica o dado de exibição do JudgeProfile (se vinculado) por cima
  // da linha JudgeParticipation — a linha local vira só um snapshot
  // congelado uma vez que userId é preenchido. Idêntico a
  // ProgramsService.toProgramView.
  private async toJudgeView(
    participation: JudgeParticipation,
  ): Promise<JudgeParticipation> {
    if (!participation.userId) return participation;
    const profile = await this.profilesRepo.findOneBy({
      userId: participation.userId,
    });
    if (!profile) return participation;
    return {
      ...participation,
      name: profile.name,
      email: profile.contactEmail,
    };
  }
}

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProgramParticipation } from '../entities/program-participation.entity';
import { ProgramProfile } from '../entities/program-profile.entity';
import { CreateProgramParticipationDto } from '../dto/create-program-participation.dto';
import { UpdateProgramParticipationDto } from '../dto/update-program-participation.dto';
import { UpdateOwnProgramDto } from '../dto/update-own-program.dto';
import { Event } from '../../events/entities/event.entity';
import { EventsService } from '../../events/services/events.service';
import { UsersService } from '../../users/services/users.service';
import type { User } from '../../users/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { stripUndefined } from '../../common/utils/strip-undefined';

interface ProgramUserInfo {
  email: string;
  firstName: string;
  lastName: string;
  teamOrInstitutionName?: string | null;
}

export interface ProgramCatalogEntry {
  source: 'platform' | 'own';
  programId?: string;
  userId: string | null;
  name: string;
  email: string;
  city: string | null;
  state: string | null;
  logoUrl: string | null;
  usedByMe?: boolean;
}

@Injectable()
export class ProgramsService {
  constructor(
    @InjectRepository(ProgramParticipation)
    private readonly participationsRepo: Repository<ProgramParticipation>,
    @InjectRepository(ProgramProfile)
    private readonly profilesRepo: Repository<ProgramProfile>,
    private readonly eventsService: EventsService,
    private readonly usersService: UsersService,
  ) {}

  async create(
    eventId: string,
    dto: CreateProgramParticipationDto,
    createdById: string,
  ): Promise<ProgramParticipation> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    let userId = dto.userId ?? null;
    let eligibleUser: User | null = null;
    if (userId) {
      await this.assertProgramUser(userId);
    } else {
      // Nenhum userId veio do picker do catálogo — antes de criar uma
      // linha solta, confere se o email digitado já não é de uma conta
      // PROGRAM real da plataforma, pra vincular direto em vez de
      // deixar uma entrada duplicada/órfã que nunca vai se reclamar
      // sozinha (o merge automático só roda no set-password, e essa
      // conta pode já ter passado por ali há muito tempo).
      eligibleUser = await this.findEligibleProgramUserByEmail(dto.email);
      userId = eligibleUser?.id ?? null;
    }
    await this.assertNoDuplicateInCatalog(createdById, dto.name, dto.email);
    if (userId) {
      // Nome/email vêm da conta REAL (mesma fonte de verdade de
      // linkUnclaimedProgramsByEmail) — cidade/estado não existem no
      // User, então usam o que acabou de ser digitado (melhor fonte
      // disponível nesse momento). Só cria se não existir, nunca
      // sobrescreve um perfil que o próprio programa já tenha editado.
      await this.getOrCreateProfile(
        userId,
        eligibleUser
          ? {
              name:
                eligibleUser.teamOrInstitutionName ||
                `${eligibleUser.firstName} ${eligibleUser.lastName}`,
              contactEmail: eligibleUser.email,
              city: dto.city,
              state: dto.state,
            }
          : undefined,
      );
    }
    const participation = this.participationsRepo.create({
      ...dto,
      userId,
      aliasId: event.aliasId,
      createdById,
    });
    const saved = await this.participationsRepo.save(participation);
    return this.toProgramView(saved);
  }

  async findAllForEvent(eventId: string): Promise<ProgramParticipation[]> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const participations = await this.participationsRepo
      .createQueryBuilder('participation')
      .loadRelationCountAndMap(
        'participation.teamsCount',
        'participation.teams',
      )
      .where('participation.aliasId = :aliasId', { aliasId: event.aliasId })
      .orderBy('participation.createdAt', 'DESC')
      .getMany();
    return Promise.all(participations.map((p) => this.toProgramView(p)));
  }

  async findOneForEvent(
    eventId: string,
    id: string,
  ): Promise<ProgramParticipation> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const participation = await this.participationsRepo.findOne({
      where: { id, aliasId: event.aliasId },
      relations: ['teams', 'teams.categories'],
    });
    if (!participation) throw new NotFoundException('Programa não encontrado');
    return this.toProgramView(participation);
  }

  // Organizador não pode mais editar nome/email/cidade/estado de um
  // programa já vinculado a uma conta própria (userId preenchido) — só
  // o próprio programa edita, via updateOwnProfile. Isso vale mesmo
  // que o vínculo tenha sido feito manualmente (via dto.userId) numa
  // edição anterior, não só pelo merge automático no registro.
  async update(
    eventId: string,
    id: string,
    dto: UpdateProgramParticipationDto,
  ): Promise<ProgramParticipation> {
    const participation = await this.findProgramOrThrow(eventId, id);
    if (participation.userId) {
      throw new ForbiddenException(
        'Este programa já está vinculado a uma conta própria — os dados são editados pelo próprio programa, não pelo organizador.',
      );
    }
    if (dto.userId) {
      await this.assertProgramUser(dto.userId);
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
    return this.toProgramView(saved);
  }

  async remove(eventId: string, id: string): Promise<void> {
    const participation = await this.findProgramOrThrow(eventId, id);
    await this.participationsRepo.remove(participation);
  }

  async setLogo(
    eventId: string,
    id: string,
    file: Express.Multer.File,
  ): Promise<ProgramParticipation> {
    const participation = await this.findProgramOrThrow(eventId, id);
    participation.logoUrl = `/uploads/logos/${file.filename}`;
    const saved = await this.participationsRepo.save(participation);
    return this.toProgramView(saved);
  }

  // Usado por TeamsService pra validar que o programa existe antes de
  // criar/editar uma equipe vinculada a ele.
  async findProgramOrThrow(
    eventId: string,
    id: string,
  ): Promise<ProgramParticipation> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const participation = await this.participationsRepo.findOneBy({
      id,
      aliasId: event.aliasId,
    });
    if (!participation) throw new NotFoundException('Programa não encontrado');
    return participation;
  }

  private async assertProgramUser(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (user.role !== UserRole.PROGRAM) {
      throw new ConflictException(
        'O usuário selecionado não é do tipo Programa.',
      );
    }
  }

  private async findEligibleProgramUserByEmail(
    email: string,
  ): Promise<User | null> {
    const user = await this.usersService.findByEmailInsensitive(email);
    if (!user || user.role !== UserRole.PROGRAM) return null;
    return user;
  }

  // Impede um produtor de acumular duas entradas divergentes no
  // próprio catálogo (mesmo nome OU mesmo email, mas dados diferentes)
  // — reaproveitar o mesmo nome+email exatos (pra usar em outro
  // evento) continua permitido, só isso não conta como duplicidade.
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
      'Você já tem um programa com esse nome ou email cadastrado, com dados diferentes — reaproveite pelo catálogo em vez de cadastrar de novo.',
    );
  }

  // Vincula automaticamente ao usuário recém-registrado (role PROGRAM)
  // toda ProgramParticipation que já existia (cadastrada manualmente
  // por algum organizador, userId ainda null) com o mesmo email — em
  // qualquer evento. Chamado por AuthService.setPassword, no momento
  // em que o cadastro é considerado completo. Também cria o
  // ProgramProfile canônico (se ainda não existir), semeado com os
  // dados do usuário + cidade/estado da primeira linha reclamada que
  // tiver esses dados.
  async linkUnclaimedProgramsByEmail(
    userId: string,
    user: ProgramUserInfo,
  ): Promise<number> {
    const unclaimed = await this.participationsRepo
      .createQueryBuilder('participation')
      .where('LOWER(participation.email) = LOWER(:email)', {
        email: user.email,
      })
      .andWhere('participation.userId IS NULL')
      .getMany();

    if (unclaimed.length === 0) return 0;

    const name =
      user.teamOrInstitutionName || `${user.firstName} ${user.lastName}`;
    const seed = unclaimed.find((p) => p.city && p.state);
    await this.getOrCreateProfile(userId, {
      name,
      contactEmail: user.email,
      city: seed?.city ?? null,
      state: seed?.state ?? null,
    });

    await this.participationsRepo
      .createQueryBuilder()
      .update(ProgramParticipation)
      .set({ userId })
      .where('id IN (:...ids)', { ids: unclaimed.map((p) => p.id) })
      .execute();

    return unclaimed.length;
  }

  // A partir daqui, endpoints de "programs/me" (ProgramProfileController)
  // — usados pelo próprio usuário PROGRAM pra gerenciar o perfil
  // canônico e ver os eventos em que está incluído.
  async findAllForUser(userId: string): Promise<{
    profile: ProgramProfile;
    events: Array<{ eventId: string; eventName?: string; startDate?: string }>;
  }> {
    const profile = await this.getOrCreateProfile(userId);
    // ProgramParticipation não tem mais relação TypeORM com Event (só
    // aliasId, sem FK) — join manual pela versão ATIVA de cada aliasId,
    // já que o eventId devolvido pro frontend precisa continuar sendo o
    // id de uma versão navegável (rotas continuam endereçadas por id de
    // versão, não por aliasId).
    const rows = await this.participationsRepo
      .createQueryBuilder('p')
      .leftJoin(
        Event,
        'event',
        'event.aliasId = p.aliasId AND event.active = true',
      )
      .where('p.userId = :userId', { userId })
      .select('p.id', 'id')
      .addSelect('event.id', 'eventId')
      .addSelect('event.name', 'eventName')
      .addSelect('event.startDate', 'startDate')
      .orderBy('p.createdAt', 'DESC')
      .getRawMany<{
        id: string;
        eventId: string | null;
        eventName: string | null;
        startDate: string | null;
      }>();
    return {
      profile,
      events: rows.map((r) => ({
        eventId: r.eventId ?? '',
        eventName: r.eventName ?? undefined,
        startDate: r.startDate ?? undefined,
      })),
    };
  }

  async updateOwnProfile(
    userId: string,
    dto: UpdateOwnProgramDto,
  ): Promise<ProgramProfile> {
    const profile = await this.getOrCreateProfile(userId);
    Object.assign(profile, stripUndefined(dto));
    return this.profilesRepo.save(profile);
  }

  // Todo usuário role PROGRAM da plataforma + as entradas do catálogo
  // deste produtor que ainda não têm conta própria (senão já
  // apareceriam no primeiro grupo) — ver ProgramFormFields no
  // frontend.
  async findCatalogForUser(
    createdById: string,
  ): Promise<ProgramCatalogEntry[]> {
    const programUsers = await this.usersService.findAllByRole(
      UserRole.PROGRAM,
    );
    const myParticipations = await this.participationsRepo.find({
      where: { createdById },
    });
    const myUserIds = new Set(
      myParticipations.filter((p) => p.userId).map((p) => p.userId as string),
    );

    const platformEntries: ProgramCatalogEntry[] = [];
    for (const user of programUsers) {
      const profile = await this.profilesRepo.findOneBy({ userId: user.id });
      platformEntries.push({
        source: 'platform',
        userId: user.id,
        name:
          profile?.name ??
          user.teamOrInstitutionName ??
          `${user.firstName} ${user.lastName}`,
        email: profile?.contactEmail ?? user.email,
        city: profile?.city ?? null,
        state: profile?.state ?? null,
        logoUrl: profile?.logoUrl ?? null,
        usedByMe: myUserIds.has(user.id),
      });
    }

    const unclaimedOwnEntries: ProgramCatalogEntry[] = myParticipations
      .filter((p) => !p.userId)
      .map((p) => ({
        source: 'own',
        programId: p.id,
        userId: null,
        name: p.name,
        email: p.email,
        city: p.city,
        state: p.state,
        logoUrl: p.logoUrl,
      }));

    return [...platformEntries, ...unclaimedOwnEntries];
  }

  private async getOrCreateProfile(
    userId: string,
    seed?: {
      name: string;
      contactEmail: string;
      city: string | null;
      state: string | null;
    },
  ): Promise<ProgramProfile> {
    const existing = await this.profilesRepo.findOneBy({ userId });
    if (existing) return existing;

    let initial = seed;
    if (!initial) {
      const user = await this.usersService.findById(userId);
      if (!user) throw new NotFoundException('Usuário não encontrado');
      initial = {
        name:
          user.teamOrInstitutionName || `${user.firstName} ${user.lastName}`,
        contactEmail: user.email,
        city: null,
        state: null,
      };
    }
    const profile = this.profilesRepo.create({
      userId,
      ...initial,
      logoUrl: null,
    });
    return this.profilesRepo.save(profile);
  }

  // Aplica o dado de exibição do ProgramProfile (se vinculado) por
  // cima da linha ProgramParticipation — a linha local vira só um
  // snapshot congelado uma vez que userId é preenchido (ver comentário
  // na entidade).
  private async toProgramView(
    participation: ProgramParticipation,
  ): Promise<ProgramParticipation> {
    if (!participation.userId) return participation;
    const profile = await this.profilesRepo.findOneBy({
      userId: participation.userId,
    });
    if (!profile) return participation;
    return {
      ...participation,
      name: profile.name,
      email: profile.contactEmail,
      city: profile.city ?? participation.city,
      state: profile.state ?? participation.state,
      logoUrl: profile.logoUrl ?? participation.logoUrl,
    };
  }
}

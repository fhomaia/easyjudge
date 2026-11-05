import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { cpf as cpfValidator } from 'cpf-cnpj-validator';
import { ProgramAthlete } from '../entities/program-athlete.entity';
import { TeamCategoryAthlete } from '../entities/team-category-athlete.entity';
import { Team } from '../../teams/entities/team.entity';
import { CreateProgramAthleteDto } from '../dto/create-program-athlete.dto';
import { UpdateProgramAthleteDto } from '../dto/update-program-athlete.dto';
import { AthleteEntryDto } from '../dto/set-athlete-entries.dto';
import { ProgramsService } from './programs.service';
import { EventActivityLogService } from '../../events/services/event-activity-log.service';
import { EventActivityAction } from '../../events/enums/event-activity-action.enum';
import { EventsService } from '../../events/services/events.service';
import { AthletesService } from '../../athletes/services/athletes.service';
import { UsersService } from '../../users/services/users.service';
import { ProgramParticipation } from '../entities/program-participation.entity';
import { UserRole } from '../../common/enums/user-role.enum';

export interface ProgramAthleteEntryView {
  teamId: string;
  categoryId: string;
}

export interface ProgramAthleteView {
  id: string;
  programId: string;
  firstName: string;
  lastName: string;
  email: string;
  cpf: string | null;
  birthDate: string | null;
  // CPF e data de nascimento da CONTA do atleta (mesmo email), quando
  // existem: valem antes dos do atleta do evento e não se editam aqui
  // (uma data/CPF por atleta, 2026-10-06).
  accountCpf: string | null;
  accountBirthDate: string | null;
  // O próprio atleta enviou a parte dele (ver ProgramAthlete).
  athleteSubmittedAt: Date | null;
  createdAt: Date;
  entries: ProgramAthleteEntryView[];
}

// Atletas inscritos por um programa num evento e em quais equipe+categoria
// cada um compete (2026-10-04, ver ProgramAthlete). Tudo opcional: o resto
// do sistema não depende disso.
@Injectable()
export class ProgramAthletesService {
  private readonly logger = new Logger(ProgramAthletesService.name);

  constructor(
    @InjectRepository(ProgramAthlete)
    private readonly athletesRepo: Repository<ProgramAthlete>,
    @InjectRepository(TeamCategoryAthlete)
    private readonly entriesRepo: Repository<TeamCategoryAthlete>,
    @InjectRepository(Team)
    private readonly teamsRepo: Repository<Team>,
    private readonly programsService: ProgramsService,
    private readonly activityLogService: EventActivityLogService,
    private readonly eventsService: EventsService,
    private readonly athletesService: AthletesService,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  // O produtor só vê os dados de atletas inscritos (2026-10-11, decisão do
  // usuário, LGPD): com categoria, com ficha enviada pelo próprio atleta
  // (qualquer status do pedido depois do envio) ou cadastrados por ele.
  // Rascunho de pedido e o resto do elenco ficam entre atleta e programa.
  async staffVisibleIds(programId: string): Promise<Set<string>> {
    const rows: { id: string }[] = await this.athletesRepo.query(
      `SELECT pa.id FROM program_athletes pa
       WHERE pa.program_id = $1 AND (
         pa.created_by_producer
         OR pa.athlete_submitted_at IS NOT NULL
         OR EXISTS (SELECT 1 FROM team_category_athletes t WHERE t.athlete_id = pa.id)
         OR EXISTS (
           SELECT 1 FROM athlete_registration_requests r
           WHERE r.program_athlete_id = pa.id
             AND (r.submitted_at IS NOT NULL OR r.status <> 'draft')
         )
       )`,
      [programId],
    );
    return new Set(rows.map((r) => r.id));
  }

  async assertStaffCanSee(programId: string, athleteId: string): Promise<void> {
    if (!(await this.staffVisibleIds(programId)).has(athleteId)) {
      throw new NotFoundException('Atleta não encontrado.');
    }
  }

  async list(
    eventId: string,
    programId: string,
    // Produtor: só os atletas que ele pode ver (staffVisibleIds).
    staff = false,
  ): Promise<ProgramAthleteView[]> {
    await this.programsService.findProgramOrThrow(eventId, programId);
    let athletes = await this.athletesRepo.find({
      where: { programId },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    if (staff) {
      const visible = await this.staffVisibleIds(programId);
      athletes = athletes.filter((a) => visible.has(a.id));
    }
    const entries = athletes.length
      ? await this.entriesRepo.findBy({
          athleteId: In(athletes.map((a) => a.id)),
        })
      : [];
    const byAthlete = new Map<string, ProgramAthleteEntryView[]>();
    for (const e of entries) {
      const list = byAthlete.get(e.athleteId) ?? [];
      list.push({ teamId: e.teamId, categoryId: e.categoryId });
      byAthlete.set(e.athleteId, list);
    }
    return this.withAccount(
      athletes.map((a) => this.toView(a, byAthlete.get(a.id) ?? [])),
    );
  }

  async create(
    eventId: string,
    programId: string,
    dto: CreateProgramAthleteDto,
    userId: string,
    byProducer = false,
  ): Promise<ProgramAthleteView> {
    const program = await this.programsService.findProgramOrThrow(
      eventId,
      programId,
    );
    const data = {
      firstName: dto.firstName.trim(),
      lastName: (dto.lastName ?? '').trim(),
      email: dto.email.trim().toLowerCase(),
      cpf: dto.cpf ?? null,
      birthDate: dto.birthDate ?? null,
    };
    this.assertValidCpfAndBirthDate(data.cpf, data.birthDate);
    await this.assertNotProgramAccount(data.email);
    if (byProducer) {
      const adopted = await this.adoptHiddenAthlete(programId, data.email);
      if (adopted) return adopted;
    }
    await this.assertUnique(programId, data.email, data.cpf, null);

    const saved = await this.saveHandlingConflict(
      this.athletesRepo.create({
        programId,
        aliasId: program.aliasId,
        ...data,
        createdByProducer: byProducer,
      }),
    );
    await this.activityLogService.record(
      program.aliasId,
      userId,
      EventActivityAction.ATHLETE_CREATED,
      this.displayName(saved),
    );
    await this.requestProgramLink(program, saved, userId);
    return (await this.withAccount([this.toView(saved, [])]))[0];
  }

  async update(
    eventId: string,
    programId: string,
    athleteId: string,
    dto: UpdateProgramAthleteDto,
    userId: string,
  ): Promise<ProgramAthleteView> {
    const athlete = await this.findAthleteOrThrow(
      eventId,
      programId,
      athleteId,
    );
    if (dto.firstName !== undefined) athlete.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) athlete.lastName = dto.lastName.trim();
    const previousEmail = athlete.email;
    if (dto.email !== undefined) athlete.email = dto.email.trim().toLowerCase();
    if (dto.cpf !== undefined) athlete.cpf = dto.cpf;
    if (dto.birthDate !== undefined) athlete.birthDate = dto.birthDate;
    this.assertValidCpfAndBirthDate(athlete.cpf, athlete.birthDate);
    if (athlete.email !== previousEmail) {
      await this.assertNotProgramAccount(athlete.email);
    }
    await this.assertUnique(programId, athlete.email, athlete.cpf, athlete.id);

    const saved = await this.saveHandlingConflict(athlete);
    await this.activityLogService.record(
      athlete.aliasId,
      userId,
      EventActivityAction.ATHLETE_UPDATED,
      this.displayName(saved),
    );
    if (saved.email !== previousEmail) {
      const program = await this.programsService.findProgramOrThrow(
        eventId,
        programId,
      );
      await this.requestProgramLink(program, saved, userId);
    }
    const entries = await this.entriesRepo.findBy({ athleteId });
    return (
      await this.withAccount([
        this.toView(
          saved,
          entries.map((e) => ({ teamId: e.teamId, categoryId: e.categoryId })),
        ),
      ])
    )[0];
  }

  async remove(
    eventId: string,
    programId: string,
    athleteId: string,
    userId: string,
  ): Promise<void> {
    const athlete = await this.findAthleteOrThrow(
      eventId,
      programId,
      athleteId,
    );
    await this.athletesRepo.remove(athlete);
    await this.activityLogService.record(
      athlete.aliasId,
      userId,
      EventActivityAction.ATHLETE_DELETED,
      this.displayName(athlete),
    );
  }

  // Pede o vínculo atleta<->programa (global) em nome do evento, ver
  // AthletesService.requestLinkFromEvent. Melhor esforço: o atleta do
  // evento já foi salvo e não depende disso, então uma falha aqui só vai
  // pro log. Trocar o email pede de novo pro email novo; o pedido antigo
  // continua (é do programa, não do evento).
  private async requestProgramLink(
    program: ProgramParticipation,
    athlete: ProgramAthlete,
    userId: string,
  ): Promise<void> {
    try {
      // O próprio programa inscrevendo o atleta não precisa confirmar.
      const byProgram = program.userId !== null && program.userId === userId;
      const event = byProgram
        ? null
        : await this.eventsService.findEventOrThrow(program.aliasId);
      await this.athletesService.requestLinkFromEvent({
        programUserId: program.userId,
        programEmail: program.email,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        email: athlete.email,
        eventName: event?.name ?? null,
        createdById: userId,
      });
    } catch (err) {
      this.logger.error(
        `Falha ao pedir vínculo do atleta ${athlete.id} com o programa ${program.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // Visão do atleta: substitui todas as equipe+categoria dele.
  async setAthleteEntries(
    eventId: string,
    programId: string,
    athleteId: string,
    entries: AthleteEntryDto[],
  ): Promise<ProgramAthleteView> {
    const athlete = await this.findAthleteOrThrow(
      eventId,
      programId,
      athleteId,
    );
    const unique = [
      ...new Map(
        entries.map((e) => [`${e.teamId}:${e.categoryId}`, e]),
      ).values(),
    ];
    await this.assertTeamCategoryPairs(programId, unique);

    // Só apaga/insere o que mudou: a hora de entrada (createdAt) decide
    // quem fica com a pendência num conflito de crossover.
    await this.dataSource.transaction(async (manager) => {
      const current = await manager.findBy(TeamCategoryAthlete, { athleteId });
      const key = (e: { teamId: string; categoryId: string }) =>
        `${e.teamId}:${e.categoryId}`;
      const wanted = new Set(unique.map(key));
      const existing = new Set(current.map(key));
      for (const e of current.filter((c) => !wanted.has(key(c)))) {
        await manager.delete(TeamCategoryAthlete, {
          athleteId,
          teamId: e.teamId,
          categoryId: e.categoryId,
        });
      }
      const added = unique.filter((e) => !existing.has(key(e)));
      if (added.length) {
        await manager.insert(
          TeamCategoryAthlete,
          added.map((e) => ({
            teamId: e.teamId,
            categoryId: e.categoryId,
            athleteId,
          })),
        );
      }
    });
    return (
      await this.withAccount([
        this.toView(
          athlete,
          unique.map((e) => ({ teamId: e.teamId, categoryId: e.categoryId })),
        ),
      ])
    )[0];
  }

  // Visão da equipe: substitui os atletas de uma equipe numa categoria.
  async setTeamCategoryAthletes(
    eventId: string,
    programId: string,
    teamId: string,
    categoryId: string,
    athleteIds: string[],
  ): Promise<{ athleteIds: string[] }> {
    await this.programsService.findProgramOrThrow(eventId, programId);
    await this.assertTeamCategoryPairs(programId, [{ teamId, categoryId }]);
    const unique = [...new Set(athleteIds)];
    if (unique.length) {
      const count = await this.athletesRepo.countBy({
        id: In(unique),
        programId,
      });
      if (count !== unique.length) {
        throw new NotFoundException('Atleta não encontrado neste programa.');
      }
    }

    // Só apaga/insere o que mudou (ver setAthleteEntries).
    await this.dataSource.transaction(async (manager) => {
      const current = (
        await manager.findBy(TeamCategoryAthlete, { teamId, categoryId })
      ).map((e) => e.athleteId);
      const removed = current.filter((id) => !unique.includes(id));
      if (removed.length) {
        await manager.delete(TeamCategoryAthlete, {
          teamId,
          categoryId,
          athleteId: In(removed),
        });
      }
      const added = unique.filter((id) => !current.includes(id));
      if (added.length) {
        await manager.insert(
          TeamCategoryAthlete,
          added.map((athleteId) => ({ teamId, categoryId, athleteId })),
        );
      }
    });
    return { athleteIds: unique };
  }

  // Conta Programa nunca é atleta: o cadastro ficaria sem dono possível.
  private async assertNotProgramAccount(email: string): Promise<void> {
    const user = await this.usersService.findByEmailInsensitive(email);
    if (user?.role === UserRole.PROGRAM) {
      throw new BadRequestException(
        'Este email é de uma conta Programa e não pode ser usado para um atleta.',
      );
    }
  }

  // Produtor inscrevendo um email que já existe no programa mas que ele não
  // vê (pedido do atleta em rascunho, ou inscrição que o programa começou e
  // não terminou): ele assume esse atleta (2026-10-11, decisão do usuário).
  // O rascunho do pedido do atleta é descartado; com as categorias gravadas
  // pelo produtor, o atleta vê a inscrição como feita pelo programa.
  private async adoptHiddenAthlete(
    programId: string,
    email: string,
  ): Promise<ProgramAthleteView | null> {
    const existing = await this.athletesRepo
      .createQueryBuilder('a')
      .where('a.programId = :programId', { programId })
      .andWhere('LOWER(a.email) = :email', { email })
      .getOne();
    if (!existing) return null;
    if ((await this.staffVisibleIds(programId)).has(existing.id)) return null;
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM athlete_registration_requests
         WHERE program_athlete_id = $1 AND status = 'draft'`,
        [existing.id],
      );
      await manager.update(ProgramAthlete, existing.id, {
        createdByProducer: true,
      });
    });
    existing.createdByProducer = true;
    return (await this.withAccount([this.toView(existing, [])]))[0];
  }

  private async findAthleteOrThrow(
    eventId: string,
    programId: string,
    athleteId: string,
  ): Promise<ProgramAthlete> {
    await this.programsService.findProgramOrThrow(eventId, programId);
    const athlete = await this.athletesRepo.findOneBy({
      id: athleteId,
      programId,
    });
    if (!athlete) throw new NotFoundException('Atleta não encontrado.');
    return athlete;
  }

  // Cada par precisa ser uma categoria que a equipe (deste programa) já tem.
  private async assertTeamCategoryPairs(
    programId: string,
    pairs: { teamId: string; categoryId: string }[],
  ): Promise<void> {
    if (pairs.length === 0) return;
    const teams = await this.teamsRepo.find({
      where: { id: In([...new Set(pairs.map((p) => p.teamId))]), programId },
      relations: ['categories'],
    });
    const valid = new Set(
      teams.flatMap((t) => t.categories.map((c) => `${t.id}:${c.id}`)),
    );
    if (pairs.some((p) => !valid.has(`${p.teamId}:${p.categoryId}`))) {
      throw new BadRequestException(
        'A equipe não está inscrita nesta categoria.',
      );
    }
  }

  private assertValidCpfAndBirthDate(
    cpf: string | null,
    birthDate: string | null,
  ): void {
    if (cpf && !cpfValidator.isValid(cpf)) {
      throw new BadRequestException('CPF inválido.');
    }
    if (birthDate && birthDate > new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException(
        'A data de nascimento não pode estar no futuro.',
      );
    }
  }

  private async assertUnique(
    programId: string,
    email: string,
    cpf: string | null,
    exceptId: string | null,
  ): Promise<void> {
    const qb = this.athletesRepo
      .createQueryBuilder('a')
      .where('a.programId = :programId', { programId })
      .andWhere(
        cpf
          ? '(LOWER(a.email) = :email OR a.cpf = :cpf)'
          : 'LOWER(a.email) = :email',
        {
          email,
          cpf,
        },
      );
    if (exceptId) qb.andWhere('a.id != :exceptId', { exceptId });
    const existing = await qb.getOne();
    if (!existing) return;
    throw new ConflictException(
      existing.email.toLowerCase() === email
        ? 'Já existe um atleta com este email neste programa.'
        : 'Já existe um atleta com este CPF neste programa.',
    );
  }

  // Corrida entre dois cadastros iguais: os índices únicos da migration
  // seguram, e o erro vira o mesmo 409 da checagem acima.
  private async saveHandlingConflict(
    athlete: ProgramAthlete,
  ): Promise<ProgramAthlete> {
    try {
      return await this.athletesRepo.save(athlete);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException(
          'Já existe um atleta com este email ou CPF neste programa.',
        );
      }
      throw err;
    }
  }

  private displayName(a: ProgramAthlete): string {
    return a.lastName ? `${a.firstName} ${a.lastName}` : a.firstName;
  }

  private toView(
    a: ProgramAthlete,
    entries: ProgramAthleteEntryView[],
  ): ProgramAthleteView {
    return {
      id: a.id,
      programId: a.programId,
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.email,
      cpf: a.cpf,
      birthDate: a.birthDate,
      accountCpf: null,
      accountBirthDate: null,
      athleteSubmittedAt: a.athleteSubmittedAt,
      createdAt: a.createdAt,
      entries,
    };
  }

  // Preenche CPF e data de nascimento das contas (uma consulta por campo).
  private async withAccount(
    views: ProgramAthleteView[],
  ): Promise<ProgramAthleteView[]> {
    if (views.length === 0) return views;
    const emails = views.map((v) => v.email);
    const [cpfs, birthDates] = await Promise.all([
      this.usersService.findCpfsByEmails(emails),
      this.usersService.findBirthDatesByEmails(emails),
    ]);
    return views.map((v) => ({
      ...v,
      accountCpf: cpfs.get(v.email.toLowerCase()) ?? null,
      accountBirthDate: birthDates.get(v.email.toLowerCase()) ?? null,
    }));
  }
}

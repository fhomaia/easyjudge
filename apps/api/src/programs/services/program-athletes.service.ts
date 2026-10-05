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
import { ProgramParticipation } from '../entities/program-participation.entity';

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
    private readonly dataSource: DataSource,
  ) {}

  async list(
    eventId: string,
    programId: string,
  ): Promise<ProgramAthleteView[]> {
    await this.programsService.findProgramOrThrow(eventId, programId);
    const athletes = await this.athletesRepo.find({
      where: { programId },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
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
    return athletes.map((a) => this.toView(a, byAthlete.get(a.id) ?? []));
  }

  async create(
    eventId: string,
    programId: string,
    dto: CreateProgramAthleteDto,
    userId: string,
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
    await this.assertUnique(programId, data.email, data.cpf, null);

    const saved = await this.saveHandlingConflict(
      this.athletesRepo.create({
        programId,
        aliasId: program.aliasId,
        ...data,
      }),
    );
    await this.activityLogService.record(
      program.aliasId,
      userId,
      EventActivityAction.ATHLETE_CREATED,
      this.displayName(saved),
    );
    await this.requestProgramLink(program, saved, userId);
    return this.toView(saved, []);
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
    return this.toView(
      saved,
      entries.map((e) => ({ teamId: e.teamId, categoryId: e.categoryId })),
    );
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

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(TeamCategoryAthlete, { athleteId });
      if (unique.length) {
        await manager.insert(
          TeamCategoryAthlete,
          unique.map((e) => ({
            teamId: e.teamId,
            categoryId: e.categoryId,
            athleteId,
          })),
        );
      }
    });
    return this.toView(
      athlete,
      unique.map((e) => ({ teamId: e.teamId, categoryId: e.categoryId })),
    );
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

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(TeamCategoryAthlete, { teamId, categoryId });
      if (unique.length) {
        await manager.insert(
          TeamCategoryAthlete,
          unique.map((athleteId) => ({ teamId, categoryId, athleteId })),
        );
      }
    });
    return { athleteIds: unique };
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
      createdAt: a.createdAt,
      entries,
    };
  }
}

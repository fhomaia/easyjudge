import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProgramAthlete } from '../entities/program-athlete.entity';
import { ProgramParticipation } from '../entities/program-participation.entity';
import { TeamCategoryAthlete } from '../entities/team-category-athlete.entity';
import { Team } from '../../teams/entities/team.entity';
import { Category } from '../../categories/entities/category.entity';
import { Event } from '../../events/entities/event.entity';
import { EventStatus } from '../../events/enums/event-status.enum';
import { EventsService } from '../../events/services/events.service';
import { isRegistrationOpen } from '../../events/registration-window';
import { UsersService } from '../../users/services/users.service';
import { AthleteLink } from '../../athletes/entities/athlete-link.entity';
import type { User } from '../../users/entities/user.entity';
import {
  pendingRequirements,
  ProgramAthleteRequirementsService,
  type AthleteRequirementsView,
} from './program-athlete-requirements.service';

// Prefixo do id de uma inscrição de atleta do elenco que o programa ainda
// não pôs em nenhuma categoria (sem ProgramAthlete): `program:<id>`.
const PENDING_PREFIX = 'program:';

export interface AthleteRegistrationEntry {
  programId: string;
  programName: string;
  // Atleta do evento, ou `program:<programId>` enquanto ele não existe.
  athleteId: string;
  // Equipe e categoria em que o programa colocou o atleta.
  categories: { teamName: string; categoryName: string }[];
  // Itens obrigatórios que faltam (documento contestado conta).
  pendingCount: number;
  contestedCount: number;
  requirements: AthleteRequirementsView;
}

export interface AthleteRegistrationEvent {
  eventId: string;
  name: string;
  logoUrl: string | null;
  startDate: string;
  location: string;
  registrationDeadline: string | null;
  open: boolean;
  entries: AthleteRegistrationEntry[];
}

// Lado do atleta na inscrição (2026-10-06): o atleta (conta com o mesmo
// email do atleta do evento) vê em que equipe/categoria o programa o
// colocou e completa o que falta (dados e documentos). Aparece assim que o
// programa (do elenco confirmado do atleta) começa a ficha no evento,
// mesmo antes de pôr o atleta numa categoria: dá pra mandar documentos
// cedo. Nesse caso o atleta do evento só nasce quando ele salva algo.
// Não depende de EventMember: o evento pode estar em rascunho e a ficha do
// programa ainda não enviada.
@Injectable()
export class AthleteRegistrationService {
  constructor(
    @InjectRepository(ProgramAthlete)
    private readonly athletesRepo: Repository<ProgramAthlete>,
    @InjectRepository(ProgramParticipation)
    private readonly participationsRepo: Repository<ProgramParticipation>,
    @InjectRepository(TeamCategoryAthlete)
    private readonly entriesRepo: Repository<TeamCategoryAthlete>,
    @InjectRepository(Team)
    private readonly teamsRepo: Repository<Team>,
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    @InjectRepository(AthleteLink)
    private readonly linksRepo: Repository<AthleteLink>,
    private readonly eventsService: EventsService,
    private readonly usersService: UsersService,
    private readonly requirementsService: ProgramAthleteRequirementsService,
  ) {}

  // Inscrições do atleta em eventos ainda não concluídos (Home).
  async listMine(userId: string): Promise<AthleteRegistrationEvent[]> {
    const user = await this.userOrThrow(userId);
    const athletes = await this.myAthletes(user);
    const pending = await this.pendingPrograms(user, athletes);
    const aliasIds = [
      ...new Set([
        ...athletes.map((a) => a.aliasId),
        ...pending.map((p) => p.aliasId),
      ]),
    ];
    const result: AthleteRegistrationEvent[] = [];
    for (const aliasId of aliasIds) {
      const event = await this.eventsService
        .findEventOrThrow(aliasId)
        .catch(() => null);
      if (!event || event.status === EventStatus.COMPLETED) continue;
      const view = await this.buildEvent(
        event,
        user,
        athletes.filter((a) => a.aliasId === aliasId),
        pending.filter((p) => p.aliasId === aliasId),
      );
      if (view.entries.length > 0) result.push(view);
    }
    return result.sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  async getForEvent(
    userId: string,
    eventId: string,
  ): Promise<AthleteRegistrationEvent> {
    const user = await this.userOrThrow(userId);
    const event = await this.eventsService.findEventOrThrow(eventId);
    const athletes = (await this.myAthletes(user)).filter(
      (a) => a.aliasId === event.aliasId,
    );
    const pending = (await this.pendingPrograms(user, athletes)).filter(
      (p) => p.aliasId === event.aliasId,
    );
    const view = await this.buildEvent(event, user, athletes, pending);
    if (view.entries.length === 0) {
      throw new NotFoundException(
        'Nenhum programa inscreveu você neste evento.',
      );
    }
    return view;
  }

  // Confere que a inscrição é desta conta e devolve o atleta do evento
  // (pras rotas reaproveitarem o service da ficha). Inscrição ainda sem
  // atleta do evento (`program:<id>`): `create` cria a linha (o atleta
  // salvou algo); sem `create`, 404.
  async resolve(
    userId: string,
    eventId: string,
    athleteId: string,
    { create = false } = {},
  ): Promise<{ programId: string; athleteId: string }> {
    const user = await this.userOrThrow(userId);
    const event = await this.eventsService.findEventOrThrow(eventId);
    const athletes = (await this.myAthletes(user)).filter(
      (a) => a.aliasId === event.aliasId,
    );

    if (athleteId.startsWith(PENDING_PREFIX)) {
      const programId = athleteId.slice(PENDING_PREFIX.length);
      const existing = athletes.find((a) => a.programId === programId);
      if (existing) return { programId, athleteId: existing.id };
      const participation = (await this.pendingPrograms(user, athletes)).find(
        (p) => p.id === programId && p.aliasId === event.aliasId,
      );
      if (!participation || !create) {
        throw new NotFoundException('Inscrição não encontrada.');
      }
      const created = await this.athletesRepo.save(
        this.athletesRepo.create({
          programId,
          aliasId: event.aliasId,
          firstName: user.firstName,
          lastName: user.lastName ?? '',
          email: user.email.toLowerCase(),
        }),
      );
      return { programId, athleteId: created.id };
    }

    const athlete = athletes.find((a) => a.id === athleteId);
    if (!athlete) throw new NotFoundException('Inscrição não encontrada.');
    return { programId: athlete.programId, athleteId: athlete.id };
  }

  private async userOrThrow(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new ForbiddenException();
    return user;
  }

  private myAthletes(user: User): Promise<ProgramAthlete[]> {
    return this.athletesRepo
      .createQueryBuilder('athlete')
      .where('LOWER(athlete.email) = LOWER(:email)', { email: user.email })
      .getMany();
  }

  // Fichas (rascunho ou enviadas) dos programas em que o atleta está
  // confirmado no elenco, onde ele ainda não é atleta do evento.
  private async pendingPrograms(
    user: User,
    athletes: ProgramAthlete[],
  ): Promise<ProgramParticipation[]> {
    const links = await this.linksRepo
      .createQueryBuilder('link')
      .where(
        '(link.athleteUserId = :userId OR LOWER(link.email) = LOWER(:email))',
        { userId: user.id, email: user.email },
      )
      .andWhere('link.confirmedAt IS NOT NULL')
      .andWhere('link.endedAt IS NULL')
      .andWhere('link.programUserId IS NOT NULL')
      .getMany();
    if (links.length === 0) return [];
    const participations = await this.participationsRepo.findBy({
      userId: In([...new Set(links.map((l) => l.programUserId as string))]),
    });
    const taken = new Set(athletes.map((a) => a.programId));
    return participations.filter((p) => !taken.has(p.id));
  }

  private async buildEvent(
    event: Event,
    user: User,
    athletes: ProgramAthlete[],
    pending: ProgramParticipation[],
  ): Promise<AthleteRegistrationEvent> {
    const entries = athletes.length
      ? await this.entriesRepo.findBy({
          athleteId: In(athletes.map((a) => a.id)),
        })
      : [];
    const teams = entries.length
      ? await this.teamsRepo.findBy({
          id: In([...new Set(entries.map((e) => e.teamId))]),
        })
      : [];
    const categories = entries.length
      ? await this.categoriesRepo.findBy({
          id: In([...new Set(entries.map((e) => e.categoryId))]),
        })
      : [];
    const programs = athletes.length
      ? await this.participationsRepo.findBy({
          id: In([...new Set(athletes.map((a) => a.programId))]),
        })
      : [];

    const result: AthleteRegistrationEntry[] = [];
    for (const athlete of athletes) {
      const own = entries.filter((e) => e.athleteId === athlete.id);
      const program = programs.find((p) => p.id === athlete.programId);
      if (!program) continue;
      const requirements = await this.requirementsService.list(
        event.aliasId,
        program.id,
        athlete.id,
        'athlete',
      );
      result.push({
        programId: program.id,
        programName: program.name,
        athleteId: athlete.id,
        categories: own.map((e) => ({
          teamName: teams.find((t) => t.id === e.teamId)?.name ?? '',
          categoryName:
            categories.find((c) => c.id === e.categoryId)?.name ?? '',
        })),
        pendingCount: pendingRequirements(requirements, {
          includeOptionalDocs: true,
        }).length,
        contestedCount: requirements.items.filter(
          (i) => i.applies && i.document?.status === 'contested',
        ).length,
        requirements,
      });
    }
    for (const program of pending) {
      const requirements = await this.requirementsService.previewForAthlete(
        event,
        program,
        {
          firstName: user.firstName,
          lastName: user.lastName ?? '',
          email: user.email,
        },
      );
      result.push({
        programId: program.id,
        programName: program.name,
        athleteId: `${PENDING_PREFIX}${program.id}`,
        categories: [],
        pendingCount: pendingRequirements(requirements, {
          includeOptionalDocs: true,
        }).length,
        contestedCount: 0,
        requirements,
      });
    }
    return {
      eventId: event.aliasId,
      name: event.name,
      logoUrl: event.logoUrl,
      startDate: event.startDate,
      location: event.location,
      registrationDeadline: event.registrationDeadline,
      open: isRegistrationOpen(event),
      entries: result,
    };
  }
}

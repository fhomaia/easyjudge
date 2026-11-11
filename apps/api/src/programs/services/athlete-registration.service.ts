import type { EventWithRole } from '../../events/services/events.service';
import { DocumentType } from '../../common/enums/document-type.enum';
import { RegulationsService } from '../../regulations/services/regulations.service';
import { RegulationDocument } from '../../regulations/entities/regulation-document.entity';
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
import { RegistrationStatus } from '../../events/enums/registration-status.enum';
import { UsersService } from '../../users/services/users.service';
import { AthleteLink } from '../../athletes/entities/athlete-link.entity';
import type { User } from '../../users/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { CategoryStatus } from '../../categories/enums/category-status.enum';
import { CategoryCriteriaService } from '../../categories/services/category-criteria.service';
import {
  AthleteRegistrationRequest,
  AthleteRequestStatus,
  OPEN_REQUEST_STATUSES,
} from '../entities/athlete-registration-request.entity';
import { ProgramsService } from './programs.service';
import {
  AthleteRequestsService,
  programClosedForRequests,
} from './athlete-requests.service';
import {
  pendingRequirements,
  ProgramAthleteRequirementsService,
  type AthleteRequirementsView,
} from './program-athlete-requirements.service';

// Prefixo do id de uma inscrição de atleta do elenco que o programa ainda
// não pôs em nenhuma categoria (sem ProgramAthlete): `program:<id>`.
const PENDING_PREFIX = 'program:';
// Programa do elenco (vínculo confirmado) que ainda não tem ficha neste
// evento: `programUser:<userId do programa>`. A ficha (rascunho) nasce
// quando o atleta salva algo (2026-10-10).
const PROGRAM_USER_PREFIX = 'programUser:';

export interface AthleteRequestSummary {
  id: string;
  status: AthleteRequestStatus;
  categoryIds: string[];
  note: string | null;
  responseMessage: string | null;
  submittedAt: Date | null;
  respondedAt: Date | null;
  // Prazo acabou com o pedido ainda aberto ("Não respondido no prazo").
  expired: boolean;
}

export interface AthleteRegistrationEntry {
  // Vazio enquanto o programa do elenco ainda não tem ficha no evento.
  programId: string;
  // Conta do programa (null = programa sem conta). Chave estável da
  // entrada na tela, junto com programId.
  programUserId: string | null;
  programName: string;
  // Atleta do evento, ou `program:<programId>` enquanto ele não existe.
  athleteId: string;
  // Equipe e categoria em que o programa colocou o atleta.
  categories: { teamName: string; categoryName: string }[];
  // Itens obrigatórios que faltam (documento contestado conta).
  pendingCount: number;
  contestedCount: number;
  requirements: AthleteRequirementsView;
  // Pedido de inscrição do atleta neste programa (o mais recente), ou null
  // (programa ainda não recebeu pedido, ou escalou o atleta sozinho).
  request: AthleteRequestSummary | null;
  // O programa enviou a ficha: não recebe mais pedidos.
  programClosed: boolean;
  // Sem conta na plataforma: o pedido espera o programa se cadastrar.
  programHasAccount: boolean;
  // Só na tela do evento (2026-11-10): categorias que o atleta não pode
  // pedir a este programa por causa de outro programa (motivo), e as
  // categorias que ele já tem por outros programas (limite por atleta).
  blockedCategories?: Record<string, string>;
  otherCategoryIds?: string[];
}

export interface AthleteRegistrationEvent {
  eventId: string;
  name: string;
  logoUrl: string | null;
  startDate: string;
  location: string;
  registrationDeadline: string | null;
  registrationStatus: RegistrationStatus;
  open: boolean;
  entries: AthleteRegistrationEntry[];
  // Só na tela do evento (getForEvent), não na lista da Home.
  regulationDocuments?: RegulationDocument[];
  // Só na tela do evento: categorias que o atleta pode pedir.
  categories?: Category[];
  // Só na tela do evento: limite de categorias por atleta das regras de
  // crossover (null = sem limite).
  maxCategoriesPerAthlete?: number | null;
  // Só na tela do evento: diferença máxima de nível na mesma modalidade.
  maxLevelDifference?: number | null;
  // Só na lista da Home (listMine): o evento no formato do card, pra Home
  // juntar a inscrição ao card do evento (ou criar o card, quando a pessoa
  // ainda não tem vínculo com o evento).
  event?: EventWithRole;
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
    @InjectRepository(AthleteRegistrationRequest)
    private readonly requestsRepo: Repository<AthleteRegistrationRequest>,
    private readonly eventsService: EventsService,
    private readonly programsService: ProgramsService,
    private readonly requestsService: AthleteRequestsService,
    private readonly categoryCriteriaService: CategoryCriteriaService,
    private readonly usersService: UsersService,
    private readonly requirementsService: ProgramAthleteRequirementsService,
    private readonly regulationsService: RegulationsService,
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
    const cards = await this.eventsService.findAllForUser(userId, {
      aliasIds: result.map((r) => r.eventId),
    });
    const cardByAlias = new Map(cards.map((c) => [c.aliasId, c]));
    for (const item of result) item.event = cardByAlias.get(item.eventId);
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
    const linkedPrograms = await this.linkedProgramsWithoutDraft(
      user,
      event.aliasId,
    );
    const view = await this.buildEvent(event, user, athletes, pending);
    for (const program of linkedPrograms) {
      const requirements = await this.requirementsService.previewForAthlete(
        event,
        this.participationsRepo.create({
          aliasId: event.aliasId,
          name: program.name,
          submittedAt: null,
          reopenedAt: null,
          userId: program.userId,
        }),
        {
          firstName: user.firstName,
          lastName: user.lastName ?? '',
          email: user.email,
        },
      );
      view.entries.push({
        programId: '',
        programUserId: program.userId,
        programName: program.name,
        athleteId: `${PROGRAM_USER_PREFIX}${program.userId}`,
        categories: [],
        pendingCount: pendingRequirements(requirements, {
          includeOptionalDocs: true,
        }).length,
        contestedCount: 0,
        requirements,
        request: null,
        programClosed: false,
        programHasAccount: true,
      });
    }
    // Sem programa nenhum ainda: quem já tem vínculo com o evento (ex.:
    // entrou pelo código) vê a tela pra adicionar um programa.
    if (view.entries.length === 0) {
      const { member } = await this.eventsService.getMemberForEventId(
        eventId,
        userId,
      );
      if (!member) {
        throw new NotFoundException(
          'Nenhum programa inscreveu você neste evento.',
        );
      }
    }
    // Abas na ordem em que o atleta escolheu os programas (criação do
    // atleta do evento); quem ainda não foi escolhido vai pro fim.
    const chosenAt = new Map(
      athletes.map((a) => [a.id, new Date(a.createdAt).getTime()]),
    );
    view.entries.sort(
      (a, b) =>
        (chosenAt.get(a.athleteId) ?? Infinity) -
          (chosenAt.get(b.athleteId) ?? Infinity) || 0,
    );
    view.regulationDocuments =
      await this.regulationsService.listDocumentsByAlias(event.aliasId);
    const categories = await this.categoriesRepo.find({
      where: { aliasId: event.aliasId, status: CategoryStatus.ACTIVE },
      order: { name: 'ASC' },
    });
    this.categoryCriteriaService.attachLabels(
      categories,
      await this.categoryCriteriaService.getByAlias(event.aliasId),
    );
    view.categories = categories;
    const rules = await this.regulationsService.getCrossoverRulesByAlias(
      event.aliasId,
    );
    view.maxCategoriesPerAthlete = rules.maxCategories;
    view.maxLevelDifference = rules.maxLevelDifference;
    const userCpf =
      user.documentType === DocumentType.CPF ? user.documentNumber : null;
    for (const entry of view.entries) {
      const own = athletes.find((a) => a.id === entry.athleteId);
      const conflicts = await this.requestsService.categoryConflicts(
        event,
        entry.programId,
        { email: own?.email ?? user.email, cpf: own?.cpf ?? userCpf },
      );
      entry.blockedCategories = conflicts.blocked;
      entry.otherCategoryIds = conflicts.otherCategoryIds;
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

    if (athleteId.startsWith(PROGRAM_USER_PREFIX)) {
      const programUserId = athleteId.slice(PROGRAM_USER_PREFIX.length);
      const linked = await this.linkedProgramsWithoutDraft(user, event.aliasId);
      const program = linked.find((p) => p.userId === programUserId);
      // Ficha criada entre a leitura e o clique: usa a que existe.
      const existing = await this.participationsRepo.findOneBy({
        aliasId: event.aliasId,
        userId: programUserId,
      });
      if ((!program && !existing) || !create) {
        throw new NotFoundException('Inscrição não encontrada.');
      }
      const programUser = await this.usersService.findById(programUserId);
      if (!programUser) throw new NotFoundException('Programa não encontrado.');
      const participation =
        existing ??
        (await this.programsService.createDraftForAthleteRequest(
          event.aliasId,
          user.id,
          { user: programUser },
        ));
      if (programClosedForRequests(participation)) {
        throw new NotFoundException('Inscrição não encontrada.');
      }
      const created = await this.requestsService.ensureProgramAthlete(
        participation,
        user,
      );
      return { programId: participation.id, athleteId: created.id };
    }

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
    const links = await this.confirmedLinks(user);
    if (links.length === 0) return [];
    const participations = await this.participationsRepo.findBy({
      userId: In([...new Set(links.map((l) => l.programUserId as string))]),
    });
    const taken = new Set(athletes.map((a) => a.programId));
    return participations.filter((p) => !taken.has(p.id));
  }

  // Programas do elenco do atleta (vínculo confirmado, com conta) que
  // ainda não têm ficha neste evento: o atleta pode pedir inscrição por
  // eles (2026-10-10).
  private async linkedProgramsWithoutDraft(
    user: User,
    aliasId: string,
  ): Promise<{ userId: string; name: string }[]> {
    const links = await this.confirmedLinks(user);
    const programUserIds = [
      ...new Set(links.map((l) => l.programUserId as string)),
    ];
    if (programUserIds.length === 0) return [];
    const withDraft = await this.participationsRepo.findBy({
      aliasId,
      userId: In(programUserIds),
    });
    const taken = new Set(withDraft.map((p) => p.userId));
    const result: { userId: string; name: string }[] = [];
    for (const id of programUserIds.filter((id) => !taken.has(id))) {
      const programUser = await this.usersService.findById(id);
      if (programUser?.role !== UserRole.PROGRAM) continue;
      const { profile } = await this.programsService.findAllForUser(id);
      result.push({ userId: id, name: profile.name });
    }
    return result;
  }

  private confirmedLinks(user: User): Promise<AthleteLink[]> {
    return this.linksRepo
      .createQueryBuilder('link')
      .where(
        '(link.athleteUserId = :userId OR LOWER(link.email) = LOWER(:email))',
        { userId: user.id, email: user.email },
      )
      .andWhere('link.confirmedAt IS NOT NULL')
      .andWhere('link.endedAt IS NULL')
      .andWhere('link.programUserId IS NOT NULL')
      .getMany();
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

    const requests = athletes.length
      ? await this.requestsRepo.find({
          where: {
            athleteUserId: user.id,
            programId: In(athletes.map((a) => a.programId)),
          },
          order: { createdAt: 'DESC' },
        })
      : [];
    const open = isRegistrationOpen(event);
    const requestOf = (programId: string): AthleteRequestSummary | null => {
      const r = requests.find((q) => q.programId === programId);
      if (!r) return null;
      return {
        id: r.id,
        status: r.status,
        categoryIds: r.categoryIds,
        note: r.note,
        responseMessage: r.responseMessage,
        submittedAt: r.submittedAt,
        respondedAt: r.respondedAt,
        expired: !open && OPEN_REQUEST_STATUSES.includes(r.status),
      };
    };

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
        programUserId: program.userId,
        programName: program.name.trim() || program.email,
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
        request: requestOf(program.id),
        programClosed: programClosedForRequests(program),
        programHasAccount: !!program.userId,
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
        programUserId: program.userId,
        programName: program.name.trim() || program.email,
        athleteId: `${PENDING_PREFIX}${program.id}`,
        categories: [],
        pendingCount: pendingRequirements(requirements, {
          includeOptionalDocs: true,
        }).length,
        contestedCount: 0,
        requirements,
        request: null,
        programClosed: programClosedForRequests(program),
        programHasAccount: true,
      });
    }
    return {
      eventId: event.aliasId,
      name: event.name,
      logoUrl: event.logoUrl,
      startDate: event.startDate,
      location: event.location,
      registrationDeadline: event.registrationDeadline,
      registrationStatus: event.registrationStatus,
      open: isRegistrationOpen(event),
      entries: result,
    };
  }
}

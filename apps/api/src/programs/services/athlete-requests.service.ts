import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { In, Not, Repository } from 'typeorm';
import {
  AthleteRegistrationRequest,
  AthleteRequestStatus,
  OPEN_REQUEST_STATUSES,
} from '../entities/athlete-registration-request.entity';
import { ProgramParticipation } from '../entities/program-participation.entity';
import { ProgramAthlete } from '../entities/program-athlete.entity';
import { TeamCategoryAthlete } from '../entities/team-category-athlete.entity';
import { Team } from '../../teams/entities/team.entity';
import { Category } from '../../categories/entities/category.entity';
import { CategoryStatus } from '../../categories/enums/category-status.enum';
import { Event } from '../../events/entities/event.entity';
import { EventsService } from '../../events/services/events.service';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import {
  isRegistrationOpen,
  registrationClosedMessage,
} from '../../events/registration-window';
import { UsersService } from '../../users/services/users.service';
import type { User } from '../../users/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { AthletesService } from '../../athletes/services/athletes.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/enums/notification-type.enum';
import { NotificationAudience } from '../../notifications/enums/notification-audience.enum';
import { RegulationsService } from '../../regulations/services/regulations.service';
import { MailService } from '../../auth/services/mail.service';
import { ProgramsService } from './programs.service';
import { ProgramAthletesService } from './program-athletes.service';
import {
  pendingRequirements,
  ProgramAthleteRequirementsService,
} from './program-athlete-requirements.service';
import { programCanEditRegistration } from '../registration-edit';
import { AthleteEntryDto } from '../dto/set-athlete-entries.dto';

// Ficha do programa enviada (e não devolvida pelo organizador): o programa
// "fechou" a inscrição, não recebe mais pedidos de atletas (2026-10-10).
export function programClosedForRequests(
  participation: Pick<ProgramParticipation, 'submittedAt' | 'reopenedAt'>,
): boolean {
  return !!participation.submittedAt && !participation.reopenedAt;
}

export const PROGRAM_CLOSED_MESSAGE =
  'Este programa já fechou a inscrição neste evento.';

export interface ProgramAthleteRequestView {
  id: string;
  status: AthleteRequestStatus;
  athleteId: string;
  athleteName: string;
  athleteEmail: string;
  categories: { id: string; name: string }[];
  // Onde o atleta está hoje (equipe+categoria), pra reabrir a aprovação
  // num pedido de correção.
  entries: { teamId: string; categoryId: string }[];
  note: string | null;
  responseMessage: string | null;
  submittedAt: Date | null;
  respondedAt: Date | null;
  // Dados/documentos obrigatórios que ainda faltam (pelas categorias
  // pedidas).
  pendingCount: number;
}

// Pedido de inscrição feito pelo atleta (2026-10-10): o atleta escolhe
// programa e categorias e envia; o programa aprova (escolhendo a equipe de
// cada categoria), pede correção ou recusa. Tudo até o prazo de inscrição.
// Ver AthleteRegistrationRequest.
@Injectable()
export class AthleteRequestsService {
  private readonly logger = new Logger(AthleteRequestsService.name);

  constructor(
    @InjectRepository(AthleteRegistrationRequest)
    private readonly requestsRepo: Repository<AthleteRegistrationRequest>,
    @InjectRepository(ProgramParticipation)
    private readonly participationsRepo: Repository<ProgramParticipation>,
    @InjectRepository(ProgramAthlete)
    private readonly athletesRepo: Repository<ProgramAthlete>,
    @InjectRepository(TeamCategoryAthlete)
    private readonly entriesRepo: Repository<TeamCategoryAthlete>,
    @InjectRepository(Team)
    private readonly teamsRepo: Repository<Team>,
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    private readonly eventsService: EventsService,
    private readonly usersService: UsersService,
    private readonly athletesService: AthletesService,
    private readonly programsService: ProgramsService,
    private readonly programAthletesService: ProgramAthletesService,
    private readonly requirementsService: ProgramAthleteRequirementsService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly regulationsService: RegulationsService,
  ) {}

  // --- Lado do atleta ---

  // "Adicionar programa" pelo email. Conta Programa: usa a ficha dela no
  // evento (ou cria em rascunho). Sem conta (ou conta de outro tipo): a
  // ficha fica esperando o cadastro do programa, com o nome informado; o
  // atleta nunca é impedido de seguir (decisão do usuário). Devolve um
  // aviso quando o email é de uma conta que não é de programa.
  async addProgram(
    athleteUserId: string,
    eventId: string,
    dto: { email: string },
  ): Promise<{ programId: string; athleteId: string; warning: string | null }> {
    const athlete = await this.userOrThrow(athleteUserId);
    const event = await this.eventsService.findEventOrThrow(eventId);
    this.assertOpen(event);
    const email = dto.email.trim().toLowerCase();
    if (email === athlete.email.toLowerCase()) {
      throw new BadRequestException('Informe o email do programa, não o seu.');
    }

    const owner = await this.usersService.findByEmailInsensitive(email);
    const programUser = owner?.role === UserRole.PROGRAM ? owner : null;
    let warning: string | null = null;
    let participation: ProgramParticipation | null;
    if (programUser) {
      participation = await this.participationsRepo.findOneBy({
        aliasId: event.aliasId,
        userId: programUser.id,
      });
      participation ??= await this.programsService.createDraftForAthleteRequest(
        event.aliasId,
        athleteUserId,
        { user: programUser },
      );
    } else {
      if (owner) {
        warning =
          'Este email pertence a uma conta que não é de programa. Confira com o seu programa.';
      }
      participation = await this.participationsRepo
        .createQueryBuilder('p')
        .where('p.aliasId = :aliasId', { aliasId: event.aliasId })
        .andWhere('p.userId IS NULL')
        .andWhere('LOWER(p.email) = :email', { email })
        .getOne();
      // Sem conta: o email faz as vezes de nome até o cadastro do programa
      // (linkUnclaimedProgramsByEmail troca pelo nome da conta).
      participation ??= await this.programsService.createDraftForAthleteRequest(
        event.aliasId,
        athleteUserId,
        { name: email, email },
      );
    }
    if (programClosedForRequests(participation)) {
      throw new ConflictException(PROGRAM_CLOSED_MESSAGE);
    }

    // Pedido de vínculo junto (vira confirmado na aprovação). Já existir
    // não é erro aqui.
    await this.athletesService
      .createOrRequestLink(athleteUserId, programUser?.email ?? email)
      .catch((err) => {
        if (!(err instanceof ConflictException)) throw err;
      });

    const programAthlete = await this.ensureProgramAthlete(
      participation,
      athlete,
    );
    await this.ensureOpenRequest(participation, programAthlete, athlete);
    await this.ensureAthleteMember(event.aliasId, athlete);
    return {
      programId: participation.id,
      athleteId: programAthlete.id,
      warning,
    };
  }

  // Atleta do evento do próprio atleta (cria quando falta) num programa.
  async ensureProgramAthlete(
    participation: ProgramParticipation,
    athlete: User,
  ): Promise<ProgramAthlete> {
    const existing = await this.athletesRepo
      .createQueryBuilder('a')
      .where('a.programId = :programId', { programId: participation.id })
      .andWhere('LOWER(a.email) = LOWER(:email)', { email: athlete.email })
      .getOne();
    if (existing) return existing;
    return this.athletesRepo.save(
      this.athletesRepo.create({
        programId: participation.id,
        aliasId: participation.aliasId,
        firstName: athlete.firstName,
        lastName: athlete.lastName ?? '',
        email: athlete.email.toLowerCase(),
      }),
    );
  }

  // Rascunho do pedido: categorias e recado.
  async save(
    athleteUserId: string,
    eventId: string,
    programId: string,
    athleteId: string,
    dto: { categoryIds: string[]; note?: string | null },
  ): Promise<void> {
    const { event, participation, programAthlete, athlete } =
      await this.loadAthleteSide(athleteUserId, eventId, programId, athleteId);
    this.assertAthleteCanChange(event, participation);
    const request = await this.ensureOpenRequest(
      participation,
      programAthlete,
      athlete,
    );
    if (request.status === AthleteRequestStatus.SUBMITTED) {
      throw new ConflictException(
        'Seu pedido já foi enviado e está com o programa.',
      );
    }
    const categoryIds = [...new Set(dto.categoryIds)];
    await this.assertEventCategories(event, categoryIds);
    // Limite de categorias por atleta (regras de crossover). Só barra
    // acrescentar: com o limite baixado depois, dá pra ir tirando.
    const { maxCategories } =
      await this.regulationsService.getCrossoverRulesByAlias(event.aliasId);
    if (
      maxCategories !== null &&
      categoryIds.length > maxCategories &&
      categoryIds.length > request.categoryIds.length
    ) {
      throw new BadRequestException(
        `O limite de ${maxCategories} ${maxCategories === 1 ? 'categoria' : 'categorias'} por atleta foi atingido.`,
      );
    }
    request.categoryIds = categoryIds;
    if (dto.note !== undefined) request.note = dto.note?.trim() || null;
    await this.requestsRepo.save(request);
  }

  // Envia o pedido ao programa. Precisa de ao menos uma categoria e dos
  // dados obrigatórios (documentos também, salvo permissão do produtor),
  // como o envio do programa.
  async submit(
    athleteUserId: string,
    eventId: string,
    programId: string,
    athleteId: string,
  ): Promise<void> {
    const { event, participation, programAthlete, athlete } =
      await this.loadAthleteSide(athleteUserId, eventId, programId, athleteId);
    this.assertAthleteCanChange(event, participation);
    const request = await this.ensureOpenRequest(
      participation,
      programAthlete,
      athlete,
    );
    if (request.status === AthleteRequestStatus.SUBMITTED) {
      throw new ConflictException(
        'Seu pedido já foi enviado e está com o programa.',
      );
    }
    if (request.categoryIds.length === 0) {
      throw new BadRequestException('Escolha ao menos uma categoria.');
    }
    await this.assertEventCategories(event, request.categoryIds);
    const view = await this.requirementsService.list(
      eventId,
      programId,
      athleteId,
      'athlete',
    );
    const missing = pendingRequirements(view, { includeOptionalDocs: false });
    if (missing.length > 0) {
      throw new BadRequestException(
        `Falta: ${missing.map((i) => i.requirement.label).join(', ')}.`,
      );
    }

    const resubmit = request.status === AthleteRequestStatus.CHANGES_REQUESTED;
    request.status = AthleteRequestStatus.SUBMITTED;
    request.submittedAt = new Date();
    await this.requestsRepo.save(request);
    // Trava os dados do lado do atleta (athleteLocked), como no envio
    // antigo; volta a nulo se o programa pedir correção ou recusar.
    await this.athletesRepo.update(programAthlete.id, {
      athleteSubmittedAt: new Date(),
    });
    await this.notifyProgramOfRequest(
      event,
      participation,
      athlete,
      resubmit ? 'resubmit' : 'new',
    );
  }

  // Exclui a ficha que o atleta ainda não enviou (2026-10-10): o pedido em
  // rascunho e, sem outro pedido nem categoria, o atleta do evento (com os
  // dados e documentos, em cascata). Ficha de programa criada só por causa
  // deste pedido, ainda vazia, sai junto.
  async discard(
    athleteUserId: string,
    eventId: string,
    programId: string,
    athleteId: string,
  ): Promise<void> {
    const { participation, programAthlete, athlete } =
      await this.loadAthleteSide(athleteUserId, eventId, programId, athleteId);
    const requests = await this.requestsRepo.find({
      where: { programId: participation.id, athleteUserId: athlete.id },
      order: { createdAt: 'DESC' },
    });
    const latest = requests[0];
    if (!latest || latest.status !== AthleteRequestStatus.DRAFT) {
      throw new ConflictException(
        'Só dá para excluir a ficha antes de enviar o pedido ao programa.',
      );
    }
    const entries = await this.entriesRepo.countBy({
      athleteId: programAthlete.id,
    });
    await this.requestsRepo.manager.transaction(async (manager) => {
      await manager.delete(AthleteRegistrationRequest, { id: latest.id });
      if (
        requests.length === 1 &&
        entries === 0 &&
        !programAthlete.athleteSubmittedAt
      ) {
        await manager.delete(ProgramAthlete, { id: programAthlete.id });
      }
      if (
        participation.createdById !== athleteUserId ||
        participation.submittedAt
      ) {
        return;
      }
      const [athletes, teams, others] = await Promise.all([
        manager.countBy(ProgramAthlete, { programId: participation.id }),
        manager.countBy(Team, { programId: participation.id }),
        manager.countBy(AthleteRegistrationRequest, {
          programId: participation.id,
        }),
      ]);
      if (athletes === 0 && teams === 0 && others === 0) {
        await manager.delete(ProgramParticipation, { id: participation.id });
      }
    });
  }

  // Inscrição aprovada: o atleta pede uma correção (2026-10-10). Volta pra
  // Aprovação; até o programa responder, as categorias podem mudar.
  async requestCorrection(
    athleteUserId: string,
    eventId: string,
    programId: string,
    athleteId: string,
    message: string,
  ): Promise<void> {
    const { event, participation, athlete } = await this.loadAthleteSide(
      athleteUserId,
      eventId,
      programId,
      athleteId,
    );
    this.assertAthleteCanChange(event, participation);
    const latest = await this.requestsRepo.findOne({
      where: { programId: participation.id, athleteUserId: athlete.id },
      order: { createdAt: 'DESC' },
    });
    if (latest?.status !== AthleteRequestStatus.APPROVED) {
      throw new ConflictException(
        'Só dá para pedir correção de uma inscrição aprovada.',
      );
    }
    latest.status = AthleteRequestStatus.CORRECTION_REQUESTED;
    latest.note = message.trim();
    latest.submittedAt = new Date();
    await this.requestsRepo.save(latest);
    await this.notifyProgramOfRequest(
      event,
      participation,
      athlete,
      'correction',
      latest.note,
    );
  }

  // Situação do último pedido de cada atleta do evento (rascunho do
  // atleta fica de fora: o programa não vê).
  async latestStatuses(
    programId: string,
  ): Promise<Map<string, AthleteRequestStatus>> {
    const latest: { athleteId: string; status: AthleteRequestStatus }[] =
      await this.requestsRepo.query(
        `SELECT athlete_id AS "athleteId", status FROM (
           SELECT DISTINCT ON (program_athlete_id) program_athlete_id AS athlete_id, status
             FROM athlete_registration_requests
            WHERE program_id = $1 AND status <> 'draft'
            ORDER BY program_athlete_id, created_at DESC
         ) latest`,
        [programId],
      );
    return new Map(latest.map((r) => [r.athleteId, r.status]));
  }

  // Atletas do evento cujo último pedido está aprovado (categorias
  // travadas, ver assertApprovedCategoriesKept).
  async approvedAthleteIds(programId: string): Promise<Set<string>> {
    const latest: { athleteId: string; status: string }[] =
      await this.requestsRepo.query(
        `SELECT DISTINCT ON (program_athlete_id) program_athlete_id AS "athleteId", status
           FROM athlete_registration_requests
          WHERE program_id = $1
          ORDER BY program_athlete_id, created_at DESC`,
        [programId],
      );
    return new Set(
      latest
        .filter((r) => r.status === AthleteRequestStatus.APPROVED)
        .map((r) => r.athleteId),
    );
  }

  // Trava (2026-10-10): atleta com a inscrição aprovada vai pro pagamento,
  // então o programa não muda o CONJUNTO de categorias dele (o valor pago
  // depende disso) até o atleta pedir correção. Trocar só a equipe na mesma
  // categoria pode. `change` recebe as entradas atuais dos atletas travados
  // e devolve como ficariam depois da operação.
  async assertApprovedCategoriesKept(
    programId: string,
    change: (
      entries: { athleteId: string; teamId: string; categoryId: string }[],
      lockedIds: Set<string>,
    ) => { athleteId: string; teamId: string; categoryId: string }[],
  ): Promise<void> {
    const lockedIds = await this.approvedAthleteIds(programId);
    if (lockedIds.size === 0) return;
    const before = (
      await this.entriesRepo.findBy({ athleteId: In([...lockedIds]) })
    ).map((e) => ({
      athleteId: e.athleteId,
      teamId: e.teamId,
      categoryId: e.categoryId,
    }));
    const after = change(before, lockedIds);
    const categoriesOf = (
      list: { athleteId: string; categoryId: string }[],
      id: string,
    ) =>
      [
        ...new Set(
          list.filter((e) => e.athleteId === id).map((e) => e.categoryId),
        ),
      ]
        .sort()
        .join(',');
    const changed = [...lockedIds].filter(
      (id) => categoriesOf(before, id) !== categoriesOf(after, id),
    );
    if (changed.length === 0) return;
    const athletes = await this.athletesRepo.findBy({ id: In(changed) });
    const names = athletes
      .map((a) => `${a.firstName} ${a.lastName}`.trim())
      .join(', ');
    throw new ConflictException(
      `${athletes.length === 1 ? 'A inscrição de' : 'As inscrições de'} ${names} ${athletes.length === 1 ? 'foi aprovada' : 'foram aprovadas'} e ${athletes.length === 1 ? 'segue' : 'seguem'} para o pagamento: as categorias só mudam se o atleta pedir uma correção.`,
    );
  }

  // --- Lado do programa ---

  async listForProgram(
    eventId: string,
    programUserId: string,
  ): Promise<ProgramAthleteRequestView[]> {
    const { participation } = await this.loadProgramSide(
      eventId,
      programUserId,
    );
    if (!participation) return [];
    return this.viewsFor(eventId, participation);
  }

  // Todos os pedidos que o programa vê (rascunho do atleta não conta).
  countVisibleToProgram(programId: string): Promise<number> {
    return this.requestsRepo.countBy({
      programId,
      status: Not(AthleteRequestStatus.DRAFT),
    });
  }

  // Pedidos enviados e ainda sem resposta (bloqueiam o envio da ficha).
  countAwaitingProgram(programId: string): Promise<number> {
    return this.requestsRepo.countBy({
      programId,
      status: In([
        AthleteRequestStatus.SUBMITTED,
        AthleteRequestStatus.CORRECTION_REQUESTED,
      ]),
    });
  }

  // Aprova escolhendo a equipe de cada categoria (o programa pode trocar as
  // categorias pedidas). Escala o atleta, confirma o vínculo e passa o
  // pedido pra etapa de Pagamento.
  async approve(
    eventId: string,
    programUserId: string,
    requestId: string,
    entries: AthleteEntryDto[],
  ): Promise<ProgramAthleteRequestView> {
    const { event, participation, request } = await this.loadForAnswer(
      eventId,
      programUserId,
      requestId,
    );
    const unique = [
      ...new Map(
        entries.map((e) => [`${e.teamId}:${e.categoryId}`, e]),
      ).values(),
    ];
    const categoryIds = [...new Set(unique.map((e) => e.categoryId))];
    await this.assertEventCategories(event, categoryIds);
    // Limite de categorias por atleta: só barra acrescentar além do pedido.
    const { maxCategories } =
      await this.regulationsService.getCrossoverRulesByAlias(event.aliasId);
    if (
      maxCategories !== null &&
      categoryIds.length > maxCategories &&
      categoryIds.length > request.categoryIds.length
    ) {
      throw new BadRequestException(
        `O limite de ${maxCategories} ${maxCategories === 1 ? 'categoria' : 'categorias'} por atleta foi atingido.`,
      );
    }
    const teams = await this.teamsRepo.find({
      where: {
        id: In([...new Set(unique.map((e) => e.teamId))]),
        programId: participation.id,
      },
      relations: ['categories'],
    });
    for (const entry of unique) {
      const team = teams.find((t) => t.id === entry.teamId);
      if (!team) throw new NotFoundException('Equipe não encontrada');
      if (!team.categories.some((c) => c.id === entry.categoryId)) {
        // Equipe ainda não estava na categoria: entra agora.
        await this.teamsRepo
          .createQueryBuilder()
          .relation(Team, 'categories')
          .of(team.id)
          .add(entry.categoryId);
        team.categories.push({ id: entry.categoryId } as Category);
      }
    }
    await this.programAthletesService.setAthleteEntries(
      eventId,
      participation.id,
      request.programAthleteId,
      unique,
    );
    await this.athletesService.ensureConfirmedLink(
      programUserId,
      request.athleteUserId,
    );
    request.status = AthleteRequestStatus.APPROVED;
    request.categoryIds = categoryIds;
    request.responseMessage = null;
    request.respondedAt = new Date();
    request.respondedBy = programUserId;
    await this.requestsRepo.save(request);
    await this.notifyAthleteOfAnswer(
      event,
      participation,
      request,
      'Sua inscrição foi aprovada',
      'O programa aprovou sua inscrição. A próxima etapa é o pagamento.',
    );
    return this.viewOf(eventId, participation, request);
  }

  async requestChanges(
    eventId: string,
    programUserId: string,
    requestId: string,
    message: string,
  ): Promise<ProgramAthleteRequestView> {
    const { event, participation, request } = await this.loadForAnswer(
      eventId,
      programUserId,
      requestId,
    );
    this.assertNotCorrection(request);
    request.status = AthleteRequestStatus.CHANGES_REQUESTED;
    request.responseMessage = message.trim();
    request.respondedAt = new Date();
    request.respondedBy = programUserId;
    await this.requestsRepo.save(request);
    await this.athletesRepo.update(request.programAthleteId, {
      athleteSubmittedAt: null,
    });
    await this.notifyAthleteOfAnswer(
      event,
      participation,
      request,
      'O programa pediu uma correção na sua inscrição',
      'O programa pediu uma correção na sua inscrição. Ajuste e envie de novo.',
    );
    return this.viewOf(eventId, participation, request);
  }

  async reject(
    eventId: string,
    programUserId: string,
    requestId: string,
    message: string | undefined,
  ): Promise<ProgramAthleteRequestView> {
    const { event, participation, request } = await this.loadForAnswer(
      eventId,
      programUserId,
      requestId,
    );
    this.assertNotCorrection(request);
    request.status = AthleteRequestStatus.REJECTED;
    request.responseMessage = message?.trim() || null;
    request.respondedAt = new Date();
    request.respondedBy = programUserId;
    await this.requestsRepo.save(request);
    await this.athletesRepo.update(request.programAthleteId, {
      athleteSubmittedAt: null,
    });
    await this.notifyAthleteOfAnswer(
      event,
      participation,
      request,
      'Sua inscrição foi recusada',
      'O programa recusou sua inscrição neste evento. Você pode fazer um novo pedido.',
    );
    return this.viewOf(eventId, participation, request);
  }

  // Pedido de correção: mantém a inscrição aprovada como estava.
  async keep(
    eventId: string,
    programUserId: string,
    requestId: string,
    message: string | undefined,
  ): Promise<ProgramAthleteRequestView> {
    const { event, participation, request } = await this.loadForAnswer(
      eventId,
      programUserId,
      requestId,
    );
    if (request.status !== AthleteRequestStatus.CORRECTION_REQUESTED) {
      throw new ConflictException('Este pedido não é de correção.');
    }
    request.status = AthleteRequestStatus.APPROVED;
    request.responseMessage = message?.trim() || null;
    request.respondedAt = new Date();
    request.respondedBy = programUserId;
    await this.requestsRepo.save(request);
    await this.notifyAthleteOfAnswer(
      event,
      participation,
      request,
      'Sua inscrição foi mantida',
      'O programa manteve sua inscrição como estava.',
    );
    return this.viewOf(eventId, participation, request);
  }

  private assertNotCorrection(request: AthleteRegistrationRequest): void {
    if (request.status === AthleteRequestStatus.CORRECTION_REQUESTED) {
      throw new ConflictException(
        'Num pedido de correção, aprove com as mudanças ou mantenha como está.',
      );
    }
  }

  // Programa criou a conta com o email de uma ficha que atletas abriram
  // (ProgramsService.linkUnclaimedProgramsByEmail): avisa dos pedidos que
  // já estavam esperando.
  @OnEvent('program.claimed')
  async onProgramClaimed(payload: {
    userId: string;
    participationIds: string[];
  }): Promise<void> {
    if (payload.participationIds.length === 0) return;
    const rows: { programId: string; aliasId: string; count: string }[] =
      await this.requestsRepo
        .createQueryBuilder('r')
        .select('r.programId', 'programId')
        .addSelect('r.aliasId', 'aliasId')
        .addSelect('COUNT(*)', 'count')
        .where({
          programId: In(payload.participationIds),
          status: AthleteRequestStatus.SUBMITTED,
        })
        .groupBy('r.programId')
        .addGroupBy('r.aliasId')
        .getRawMany();
    for (const row of rows) {
      const count = Number(row.count);
      await this.notificationsService.create(
        row.aliasId,
        NotificationType.ATHLETE_REGISTRATION_SUBMITTED,
        NotificationAudience.ALL,
        count === 1
          ? '1 atleta pediu inscrição pelo seu programa'
          : `${count} atletas pediram inscrição pelo seu programa`,
        undefined,
        payload.userId,
      );
    }
  }

  // --- Internos ---

  private async loadAthleteSide(
    athleteUserId: string,
    eventId: string,
    programId: string,
    athleteId: string,
  ) {
    const athlete = await this.userOrThrow(athleteUserId);
    const event = await this.eventsService.findEventOrThrow(eventId);
    const participation = await this.participationsRepo.findOneBy({
      id: programId,
      aliasId: event.aliasId,
    });
    const programAthlete = await this.athletesRepo.findOneBy({
      id: athleteId,
      programId,
    });
    if (
      !participation ||
      !programAthlete ||
      programAthlete.email.toLowerCase() !== athlete.email.toLowerCase()
    ) {
      throw new NotFoundException('Inscrição não encontrada.');
    }
    return { event, participation, programAthlete, athlete };
  }

  private assertAthleteCanChange(
    event: Event,
    participation: ProgramParticipation,
  ): void {
    this.assertOpen(event);
    if (programClosedForRequests(participation)) {
      throw new ConflictException(PROGRAM_CLOSED_MESSAGE);
    }
  }

  // Pedido aberto do atleta neste programa; cria um rascunho quando não
  // há (inclusive depois de uma recusa). Aprovado: alterações só pelo
  // programa.
  private async ensureOpenRequest(
    participation: ProgramParticipation,
    programAthlete: ProgramAthlete,
    athlete: User,
  ): Promise<AthleteRegistrationRequest> {
    const latest = await this.requestsRepo.findOne({
      where: { programId: participation.id, athleteUserId: athlete.id },
      order: { createdAt: 'DESC' },
    });
    if (latest && OPEN_REQUEST_STATUSES.includes(latest.status)) return latest;
    if (latest?.status === AthleteRequestStatus.APPROVED) {
      throw new ConflictException(
        'Sua inscrição neste programa já foi aprovada. Para mudar algo, fale com o programa.',
      );
    }
    // Atleta que o programa já escalou por conta própria: está inscrito
    // (como se aprovado), não há o que pedir.
    const entries = await this.entriesRepo.countBy({
      athleteId: programAthlete.id,
    });
    if (entries > 0) {
      throw new ConflictException(
        'O programa já inscreveu você neste evento. Para mudar algo, fale com o programa.',
      );
    }
    return this.requestsRepo.save(
      this.requestsRepo.create({
        aliasId: participation.aliasId,
        programId: participation.id,
        programAthleteId: programAthlete.id,
        athleteUserId: athlete.id,
        status: AthleteRequestStatus.DRAFT,
        categoryIds: latest?.categoryIds ?? [],
      }),
    );
  }

  // Atleta sem vínculo nenhum com o evento ganha SPECTATOR: vê o card na
  // Home e recebe as notificações do pedido.
  private async ensureAthleteMember(aliasId: string, athlete: User) {
    const member = await this.eventsService.findMemberByIdentity(aliasId, {
      userId: athlete.id,
      email: athlete.email,
    });
    if (member) return;
    await this.eventsService.upsertMemberRole(
      aliasId,
      EventMemberRole.SPECTATOR,
      {
        userId: athlete.id,
        email: athlete.email,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
      },
    );
  }

  private async loadProgramSide(eventId: string, programUserId: string) {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const participation = await this.participationsRepo.findOneBy({
      aliasId: event.aliasId,
      userId: programUserId,
    });
    return { event, participation };
  }

  // Responder (aprovar, pedir correção, recusar): pedido enviado ou
  // esperando correção, com a ficha editável e dentro do prazo.
  private async loadForAnswer(
    eventId: string,
    programUserId: string,
    requestId: string,
  ) {
    const { event, participation } = await this.loadProgramSide(
      eventId,
      programUserId,
    );
    if (!participation) throw new NotFoundException('Pedido não encontrado');
    const request = await this.requestsRepo.findOneBy({
      id: requestId,
      programId: participation.id,
    });
    if (!request) throw new NotFoundException('Pedido não encontrado');
    if (
      request.status !== AthleteRequestStatus.SUBMITTED &&
      request.status !== AthleteRequestStatus.CHANGES_REQUESTED &&
      request.status !== AthleteRequestStatus.CORRECTION_REQUESTED
    ) {
      throw new ConflictException('Este pedido já foi respondido.');
    }
    this.assertOpen(event);
    if (!programCanEditRegistration(event, participation)) {
      throw new ConflictException(
        'Sua inscrição já foi enviada. Para mudar algo, envie um pedido ao organizador.',
      );
    }
    return { event, participation, request };
  }

  private async viewsFor(
    eventId: string,
    participation: ProgramParticipation,
  ): Promise<ProgramAthleteRequestView[]> {
    // Rascunhos do atleta não aparecem pro programa.
    const requests = await this.requestsRepo.find({
      where: {
        programId: participation.id,
        status: In([
          AthleteRequestStatus.SUBMITTED,
          AthleteRequestStatus.CHANGES_REQUESTED,
          AthleteRequestStatus.APPROVED,
          AthleteRequestStatus.REJECTED,
          AthleteRequestStatus.CORRECTION_REQUESTED,
        ]),
      },
      order: { submittedAt: 'DESC' },
    });
    const views: ProgramAthleteRequestView[] = [];
    for (const request of requests) {
      views.push(await this.viewOf(eventId, participation, request));
    }
    // Esperando resposta primeiro.
    const waiting = (v: ProgramAthleteRequestView) =>
      Number(
        v.status === AthleteRequestStatus.SUBMITTED ||
          v.status === AthleteRequestStatus.CORRECTION_REQUESTED,
      );
    return views.sort((a, b) => waiting(b) - waiting(a));
  }

  private async viewOf(
    eventId: string,
    participation: ProgramParticipation,
    request: AthleteRegistrationRequest,
  ): Promise<ProgramAthleteRequestView> {
    const athlete = await this.athletesRepo.findOneByOrFail({
      id: request.programAthleteId,
    });
    const categories = request.categoryIds.length
      ? await this.categoriesRepo.findBy({ id: In(request.categoryIds) })
      : [];
    const requirements = await this.requirementsService.list(
      eventId,
      participation.id,
      athlete.id,
      'program',
    );
    const entries = await this.entriesRepo.findBy({ athleteId: athlete.id });
    return {
      id: request.id,
      status: request.status,
      athleteId: athlete.id,
      athleteName: `${athlete.firstName} ${athlete.lastName}`.trim(),
      athleteEmail: athlete.email,
      categories: request.categoryIds
        .map((id) => categories.find((c) => c.id === id))
        .filter((c): c is Category => !!c)
        .map((c) => ({ id: c.id, name: c.name })),
      entries: entries.map((e) => ({
        teamId: e.teamId,
        categoryId: e.categoryId,
      })),
      note: request.note,
      responseMessage: request.responseMessage,
      submittedAt: request.submittedAt,
      respondedAt: request.respondedAt,
      pendingCount: pendingRequirements(requirements, {
        includeOptionalDocs: true,
      }).length,
    };
  }

  // Programa com conta: notificação + email. Sem conta: convite por email
  // pra criar a conta (os pedidos são reclamados no cadastro).
  private async notifyProgramOfRequest(
    event: Event,
    participation: ProgramParticipation,
    athlete: User,
    kind: 'new' | 'resubmit' | 'correction',
    note: string | null = null,
  ): Promise<void> {
    const athleteName = `${athlete.firstName} ${athlete.lastName ?? ''}`.trim();
    const resubmit = kind === 'resubmit';
    try {
      if (participation.userId) {
        await this.notificationsService.create(
          event.aliasId,
          NotificationType.ATHLETE_REGISTRATION_SUBMITTED,
          NotificationAudience.ALL,
          kind === 'correction'
            ? `${athleteName} pediu uma correção na inscrição aprovada`
            : resubmit
              ? `${athleteName} corrigiu o pedido de inscrição`
              : `${athleteName} pediu inscrição pelo seu programa`,
          undefined,
          participation.userId,
        );
        const program = await this.programsService.findOneForEvent(
          event.aliasId,
          participation.id,
        );
        await this.mailService.sendNotice({
          to: [program.email],
          replyTo: athlete.email,
          subject:
            kind === 'correction'
              ? `[${event.name}] ${athleteName} pediu uma correção na inscrição`
              : `[${event.name}] ${athleteName} pediu inscrição pelo seu programa`,
          heading:
            kind === 'correction'
              ? 'Pedido de correção da inscrição'
              : resubmit
                ? 'Pedido de inscrição corrigido'
                : 'Novo pedido de inscrição',
          lines:
            kind === 'correction'
              ? [
                  `${athleteName} (${athlete.email}) pediu uma correção na inscrição já aprovada no evento ${event.name}.`,
                  'Aprove com as mudanças ou mantenha como está.',
                ]
              : [
                  `${athleteName} (${athlete.email}) ${resubmit ? 'corrigiu e reenviou' : 'enviou'} um pedido de inscrição no evento ${event.name} pelo ${program.name}.`,
                  'Aprove escolhendo a equipe de cada categoria, peça uma correção ou recuse.',
                ],
          message: kind === 'correction' ? (note ?? undefined) : undefined,
          actionPath: `/events/${event.aliasId}/registration`,
          actionLabel: 'Ver o pedido',
          event: { name: event.name, logoUrl: event.logoUrl },
        });
        return;
      }
      await this.mailService.sendNotice({
        to: [participation.email],
        replyTo: athlete.email,
        subject: `[${event.name}] ${athleteName} quer se inscrever pelo seu programa`,
        heading: 'Pedido de inscrição de atleta',
        lines: [
          `${athleteName} (${athlete.email}) quer se inscrever no evento ${event.name} pelo ${participation.name}.`,
          `Crie a conta do programa na Cheer Cup com este email (${participation.email}) para responder o pedido.`,
        ],
        actionPath: '/login',
        actionLabel: 'Criar conta',
        event: { name: event.name, logoUrl: event.logoUrl },
      });
    } catch (err) {
      // Aviso é melhor esforço: o pedido já está gravado.
      this.logger.error(
        'Falha ao avisar o programa do pedido de inscrição',
        err as Error,
      );
    }
  }

  private async notifyAthleteOfAnswer(
    event: Event,
    participation: ProgramParticipation,
    request: AthleteRegistrationRequest,
    title: string,
    line: string,
  ): Promise<void> {
    try {
      const athlete = await this.usersService.findById(request.athleteUserId);
      if (!athlete) return;
      const program = await this.programsService.findOneForEvent(
        event.aliasId,
        participation.id,
      );
      await this.notificationsService.create(
        event.aliasId,
        NotificationType.ATHLETE_REGISTRATION_ANSWERED,
        NotificationAudience.ALL,
        `${title} (${program.name})`,
        undefined,
        athlete.id,
      );
      await this.mailService.sendNotice({
        to: [athlete.email],
        replyTo: program.email,
        subject: `[${event.name}] ${title}`,
        heading: title,
        lines: [`${line} Programa: ${program.name}.`],
        message: request.responseMessage ?? undefined,
        actionPath: `/events/${event.aliasId}/my-registration`,
        actionLabel: 'Ver minha inscrição',
        event: { name: event.name, logoUrl: event.logoUrl },
      });
    } catch (err) {
      this.logger.error(
        'Falha ao avisar o atleta da resposta do pedido',
        err as Error,
      );
    }
  }

  private assertOpen(event: Event): void {
    if (!isRegistrationOpen(event)) {
      throw new ConflictException(registrationClosedMessage(event));
    }
  }

  private async assertEventCategories(
    event: Event,
    ids: string[],
  ): Promise<void> {
    if (ids.length === 0) return;
    const count = await this.categoriesRepo.count({
      where: {
        id: In(ids),
        aliasId: event.aliasId,
        status: CategoryStatus.ACTIVE,
      },
    });
    if (count !== ids.length)
      throw new NotFoundException('Categoria não encontrada');
  }

  private async userOrThrow(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new ForbiddenException();
    return user;
  }
}

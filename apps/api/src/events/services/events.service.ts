import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { generateEventCode } from '../../common/utils/generate-event-code';
import { Event } from '../entities/event.entity';
import { EventMember } from '../entities/event-member.entity';
import { EventMemberRole } from '../enums/event-member-role.enum';
import { EventStatus } from '../enums/event-status.enum';
import { EventActivityAction } from '../enums/event-activity-action.enum';
import { CreateEventDto } from '../dto/create-event.dto';
import { UpdateEventDto } from '../dto/update-event.dto';
import { stripUndefined } from '../../common/utils/strip-undefined';
import { EventActivityLogService } from './event-activity-log.service';
import { UsersService } from '../../users/services/users.service';
import { Category } from '../../categories/entities/category.entity';
import { ProgramParticipation } from '../../programs/entities/program-participation.entity';
import { ScheduleDay } from '../../schedule/entities/schedule-day.entity';
import { Regulation } from '../../regulations/entities/regulation.entity';
import { JudgeParticipation } from '../../judges/entities/judge-participation.entity';
import { SpecialRoleAssignment } from '../../judging/entities/special-role-assignment.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/enums/notification-type.enum';
import { NotificationAudience } from '../../notifications/enums/notification-audience.enum';

// Entidades filhas endereçadas pelo `aliasId` do evento (estável entre
// versões, não pelo `id` de uma versão específica — ver
// AddAliasIdToEventScopedChildEntities). Como `aliasId` nunca muda numa
// republicação, elas não precisam de nenhuma "adoção" em publishEvent
// (diferente do esquema antigo, que causou um bug real: evento
// republicado aparecendo com 0 categorias/0 programas porque as linhas
// filhas ficavam presas na versão antiga). Usado hoje só por
// deleteEvent, pra limpeza explícita — sem FK pra `events`, não existe
// mais `ON DELETE CASCADE` cuidando disso sozinho.
// `criterion_judge_assignments` e as tabelas de
// `schedule_resources`/`schedule_entries`/`teams` não têm `aliasId`
// próprio — saem junto via cascata normal de FK a partir de
// `schedule_days`/`judge_participations`/`program_participations`
// (que são excluídas aqui).
const EVENT_SCOPED_ENTITIES = [
  Category,
  ProgramParticipation,
  ScheduleDay,
  Regulation,
  JudgeParticipation,
  SpecialRoleAssignment,
];

// Assessores e espectadores só enxergam o evento nesses status;
// admin e jurado enxergam em qualquer status (inclusive rascunho).
const STAFF_ROLES = [EventMemberRole.ADMIN, EventMemberRole.JUDGE];
const VISIBLE_TO_NON_STAFF = [
  EventStatus.PUBLISHED,
  EventStatus.STARTED,
  EventStatus.COMPLETED,
];

// Uma pessoa pode ter mais de um papel no mesmo evento (roles[], ver
// EventMember) — pra telas que só entendem "um papel" (badges na Home,
// EventLifecycleAction), reduz pro mais "forte" dessa lista, nessa
// ordem de precedência. ATHLETE precisa vir antes de SPECTATOR: um
// atleta que escaneou o QR do evento antes de vincular a conta (ganha
// SPECTATOR ali) e depois vira atleta de um programa participante
// (ganha ATHLETE via AthletesService.syncEventAccessForLink, que só
// ACRESCENTA papel, nunca troca) fica com roles=[spectator, athlete] —
// sem ATHLETE aqui, esse método devolvia "spectator" pra essa pessoa,
// mesmo com o papel de atleta já concedido.
const ROLE_PRECEDENCE = [
  EventMemberRole.ADMIN,
  EventMemberRole.ASSESSOR,
  EventMemberRole.JUDGE,
  EventMemberRole.PROGRAM,
  EventMemberRole.ATHLETE,
  EventMemberRole.SPECTATOR,
];

function highestRole(roles: EventMemberRole[]): EventMemberRole {
  return ROLE_PRECEDENCE.find((r) => roles.includes(r)) ?? roles[0];
}

// O papel do usuário logado NO evento — não é uma coluna de Event, é
// calculado por request (join com EventMember) e anexado na resposta
// pra o frontend saber se mostra ações de admin (editar/iniciar/excluir).
// `currentUserRole` (singular, o mais "forte") é mantido pras telas que
// já existiam antes do multi-papel (Home); `currentUserRoles` (array
// completo) é o que telas novas (roster, guard de setup) devem usar.
export type EventWithRole = Event & {
  currentUserRole: EventMemberRole;
  currentUserRoles: EventMemberRole[];
};

function latestUpdatedAt(items: { updatedAt: Date }[]): Date | null {
  if (items.length === 0) return null;
  return items.reduce(
    (latest, item) => (item.updatedAt > latest ? item.updatedAt : latest),
    items[0].updatedAt,
  );
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(EventMember)
    private readonly membersRepo: Repository<EventMember>,
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    @InjectRepository(ProgramParticipation)
    private readonly programsRepo: Repository<ProgramParticipation>,
    @InjectRepository(JudgeParticipation)
    private readonly judgesRepo: Repository<JudgeParticipation>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly activityLogService: EventActivityLogService,
    private readonly notificationsService: NotificationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Cria a v1 do evento (aliasId = id, já que é a primeira versão) e o
  // membership de admin do criador, numa transação — as duas linhas
  // nascem juntas ou nenhuma nasce.
  async createEvent(dto: CreateEventDto, createdById: string): Promise<Event> {
    const id = randomUUID();
    const creator = await this.usersService.findById(createdById);
    const saved = await this.dataSource.transaction(async (manager) => {
      const event = manager.create(Event, {
        ...dto,
        competitionDays: dto.competitionDays ?? 1,
        id,
        aliasId: id,
        version: 1,
        active: true,
        status: EventStatus.CREATED,
        createdById,
      });
      const saved = await manager.save(event);

      const member = manager.create(EventMember, {
        aliasId: id,
        userId: createdById,
        roles: [EventMemberRole.ADMIN],
        firstName: creator?.firstName ?? null,
        lastName: creator?.lastName ?? null,
        email: creator?.email ?? null,
      });
      await manager.save(member);

      return saved;
    });
    await this.activityLogService.record(
      id,
      createdById,
      EventActivityAction.CREATED,
    );
    return saved;
  }

  // Lista só os eventos em que o usuário tem membership — admin/jurado
  // veem em qualquer status, assessor/espectador só em
  // published/started/completed. Cada evento vem com o(s) papel(is) do
  // próprio usuário anexado (currentUserRole/currentUserRoles), pro
  // frontend decidir quais ações (editar/iniciar/excluir) mostrar.
  async findAllForUser(userId: string): Promise<EventWithRole[]> {
    const { entities, raw } = await this.eventsRepo
      .createQueryBuilder('event')
      .addSelect(
        (qb) =>
          qb
            .subQuery()
            .select('COUNT(*)', 'count')
            .from(Category, 'c')
            .where('c.aliasId = event.aliasId'),
        'categories_count',
      )
      .addSelect(
        (qb) =>
          qb
            .subQuery()
            .select('COUNT(*)', 'count')
            .from(ProgramParticipation, 'p')
            .where('p.aliasId = event.aliasId'),
        'programs_count',
      )
      .addSelect(
        (qb) =>
          qb
            .subQuery()
            .select('COUNT(*)', 'count')
            .from(JudgeParticipation, 'j')
            .where('j.aliasId = event.aliasId'),
        'judges_count',
      )
      .innerJoin(
        EventMember,
        'member',
        'member.aliasId = event.aliasId AND member.userId = :userId',
        { userId },
      )
      .addSelect('member.roles', 'member_roles')
      .where('event.active = true')
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            'member.roles && ARRAY[:...staffRoles]::event_members_role_enum[]',
            { staffRoles: STAFF_ROLES },
          ).orWhere('event.status IN (:...visibleStatuses)', {
            visibleStatuses: VISIBLE_TO_NON_STAFF,
          });
        }),
      )
      .orderBy('event.createdAt', 'DESC')
      .getRawAndEntities();

    return entities.map((event, i) => {
      const roles = raw[i].member_roles as EventMemberRole[];
      return {
        ...event,
        currentUserRole: highestRole(roles),
        currentUserRoles: roles,
        categoriesCount: Number(raw[i].categories_count),
        programsCount: Number(raw[i].programs_count),
        judgesCount: Number(raw[i].judges_count),
      };
    });
  }

  async findOneForUser(
    aliasId: string,
    userId: string,
  ): Promise<EventWithRole> {
    const event = await this.eventsRepo.findOneBy({ aliasId, active: true });
    if (!event) throw new NotFoundException('Evento não encontrado');

    const member = await this.membersRepo.findOneBy({
      aliasId: event.aliasId,
      userId,
    });
    if (!member || !this.canSee(member.roles, event.status)) {
      throw new ForbiddenException('Você não tem acesso a este evento');
    }

    const [categories, programs, judgesCount] = await Promise.all([
      this.categoriesRepo.find({ where: { aliasId: event.aliasId } }),
      this.programsRepo.find({ where: { aliasId: event.aliasId } }),
      this.judgesRepo.count({ where: { aliasId: event.aliasId } }),
    ]);

    return {
      ...event,
      currentUserRole: highestRole(member.roles),
      currentUserRoles: member.roles,
      categoriesCount: categories.length,
      programsCount: programs.length,
      judgesCount,
      categoriesUpdatedAt: latestUpdatedAt(categories),
      programsUpdatedAt: latestUpdatedAt(programs),
    };
  }

  // Edita a versão ativa no lugar (mesma linha/id/versão). Se o evento
  // estava publicado, editar o reverte pra "criado" automaticamente —
  // só uma nova publicação (ver publishEvent) registra uma versão nova.
  async updateEvent(
    aliasId: string,
    dto: UpdateEventDto,
    userId: string,
  ): Promise<EventWithRole> {
    // Assessor também pode editar as configurações do evento (só não
    // mexe em acessos/pessoas nem no ciclo de vida — publicar/iniciar/
    // excluir continuam admin-only, ver os outros métodos abaixo).
    const event = await this.getOwnEventOrThrow(aliasId, userId, [
      EventMemberRole.ADMIN,
      EventMemberRole.ASSESSOR,
    ]);

    if (
      event.status === EventStatus.STARTED ||
      event.status === EventStatus.COMPLETED
    ) {
      throw new ConflictException(
        'Não é possível editar um evento iniciado ou concluído.',
      );
    }

    Object.assign(event, stripUndefined(dto));
    if (event.status === EventStatus.PUBLISHED) {
      event.status = EventStatus.CREATED;
    }

    const saved = await this.eventsRepo.save(event);
    await this.activityLogService.record(
      saved.aliasId,
      userId,
      EventActivityAction.UPDATED,
    );
    return this.attachRole(saved, userId);
  }

  // Publica (ou republica) o evento: desativa a versão atual e insere
  // uma nova linha com o mesmo aliasId e version + 1. As entidades
  // filhas (categorias, programas, regulamento, cronograma, jurados,
  // funções especiais) não precisam de nenhum passo extra aqui — são
  // endereçadas pelo `aliasId` (estável entre versões, ver
  // EVENT_SCOPED_ENTITIES e a migration AddAliasIdToEventScopedChildEntities),
  // não pelo `id` da versão, então continuam "grudadas" no evento certo
  // sozinhas. Isso substitui um esquema antigo que precisava "adotar"
  // cada linha filha pra nova versão nesta mesma transação — schema
  // que causou um bug real ("Easy Judge Cup" aparecendo com 0
  // categorias/0 programas depois de republicar, porque o passo de
  // adoção não existia ainda naquela época).
  async publishEvent(aliasId: string, userId: string): Promise<EventWithRole> {
    const event = await this.getOwnEventOrThrow(aliasId, userId);

    if (event.status !== EventStatus.CREATED) {
      throw new ConflictException(
        'Só é possível publicar um evento com status "criado".',
      );
    }

    const newVersion = await this.dataSource.transaction(async (manager) => {
      event.active = false;
      await manager.save(event);

      // Gera o código só na primeira publicação (event.eventCode ainda
      // nulo); nas seguintes, só carrega o mesmo código adiante — ver
      // comentário em Event.eventCode.
      const eventCode =
        event.eventCode ?? (await this.generateUniqueEventCode(manager));

      const newVersion = manager.create(Event, {
        name: event.name,
        startDate: event.startDate,
        competitionDays: event.competitionDays,
        location: event.location,
        venue: event.venue,
        logoUrl: event.logoUrl,
        createdById: event.createdById,
        eventCode,
        id: randomUUID(),
        aliasId: event.aliasId,
        version: event.version + 1,
        active: true,
        status: EventStatus.PUBLISHED,
      });
      return manager.save(newVersion);
    });
    await this.activityLogService.record(
      newVersion.aliasId,
      userId,
      EventActivityAction.PUBLISHED,
    );
    this.eventEmitter.emit('event.status_changed', {
      aliasId: newVersion.aliasId,
      status: newVersion.status,
    });
    return this.attachRole(newVersion, userId);
  }

  // Inicia o evento (published -> started) — transição de ciclo de
  // vida in-place, não versiona (diferente de publishEvent).
  async startEvent(aliasId: string, userId: string): Promise<EventWithRole> {
    const event = await this.getOwnEventOrThrow(aliasId, userId);

    if (event.status !== EventStatus.PUBLISHED) {
      throw new ConflictException('Só é possível iniciar um evento publicado.');
    }

    event.status = EventStatus.STARTED;
    event.startedAt = new Date();
    const saved = await this.eventsRepo.save(event);
    await this.activityLogService.record(
      saved.aliasId,
      userId,
      EventActivityAction.STARTED,
    );
    this.eventEmitter.emit('event.status_changed', {
      aliasId: saved.aliasId,
      status: saved.status,
    });
    return this.attachRole(saved, userId);
  }

  // Conclui o evento (started -> completed), in-place — ação manual do
  // admin/assessor (mesmo par de papéis de updateEvent/unpublishEvent;
  // diferente de startEvent, que é admin-only), sem nenhuma regra
  // automática por data (ver CLAUDE.md "Próximos passos" — decisão
  // consciente de deixar 100% manual por enquanto).
  async completeEvent(
    aliasId: string,
    userId: string,
  ): Promise<EventWithRole> {
    const event = await this.getOwnEventOrThrow(aliasId, userId, [
      EventMemberRole.ADMIN,
      EventMemberRole.ASSESSOR,
    ]);

    if (event.status !== EventStatus.STARTED) {
      throw new ConflictException(
        'Só é possível concluir um evento iniciado.',
      );
    }

    event.status = EventStatus.COMPLETED;
    event.completedAt = new Date();
    const saved = await this.eventsRepo.save(event);
    await this.activityLogService.record(
      saved.aliasId,
      userId,
      EventActivityAction.COMPLETED,
    );
    this.eventEmitter.emit('event.status_changed', {
      aliasId: saved.aliasId,
      status: saved.status,
    });
    return this.attachRole(saved, userId);
  }

  // Reverte a publicação (published/started -> created), in-place —
  // mesmo raciocínio do revert automático em updateEvent, só que como
  // ação explícita (o admin ou assessor quer voltar a editar as
  // configurações sem mexer em nenhum campo). **Atualização
  // (2026-07-27, a pedido do usuário):** passou a aceitar também
  // "started" — o popup de edição de evento (`EditEventDialog`) trava
  // os campos e oferece "Reverter publicação" tanto pra published
  // quanto pra started, então o backend precisou acompanhar. Zera
  // `startedAt` quando a origem é started (senão sobraria um "iniciado
  // em ..." de uma sessão anterior depois de reiniciar o evento).
  // **Risco consciente, não resolvido ainda**: reverter um evento
  // started que já tem `ScoreEvent` lançado não é bloqueado — os
  // dados de nota continuam no banco (event sourcing, nunca perdidos),
  // mas a competição volta a aparecer como "criada" com notas já
  // registradas por trás. Aceito por ser exatamente o que foi pedido;
  // revisitar se isso confundir um admin na prática.
  async unpublishEvent(
    aliasId: string,
    userId: string,
  ): Promise<EventWithRole> {
    const event = await this.getOwnEventOrThrow(aliasId, userId, [
      EventMemberRole.ADMIN,
      EventMemberRole.ASSESSOR,
    ]);

    if (
      event.status !== EventStatus.PUBLISHED &&
      event.status !== EventStatus.STARTED
    ) {
      throw new ConflictException(
        'Só é possível reverter um evento publicado ou iniciado.',
      );
    }

    event.status = EventStatus.CREATED;
    event.startedAt = null;
    const saved = await this.eventsRepo.save(event);
    await this.activityLogService.record(
      saved.aliasId,
      userId,
      EventActivityAction.UNPUBLISHED,
    );
    this.eventEmitter.emit('event.status_changed', {
      aliasId: saved.aliasId,
      status: saved.status,
    });
    return this.attachRole(saved, userId);
  }

  // Anexa o(s) papel(is) do usuário logado num Event já resolvido —
  // usado pelos métodos de escrita (update/publish/start) pra devolver
  // o mesmo formato EventWithRole de findOneForUser/findAllForUser, já
  // que o frontend guarda a resposta direto no estado (`currentUserRoles`
  // é lido em EventSetupPage/EventStaffPage/useEventSetupGuard logo em
  // seguida, sem dar um novo GET).
  private async attachRole(
    event: Event,
    userId: string,
  ): Promise<EventWithRole> {
    const member = await this.membersRepo.findOneBy({
      aliasId: event.aliasId,
      userId,
    });
    const roles = member?.roles ?? [];
    return {
      ...event,
      currentUserRole: highestRole(roles),
      currentUserRoles: roles,
    };
  }

  // Exclui o evento por completo: todas as versões (histórico) do
  // aliasId, não só a ativa, e todos os memberships. As 6 entidades de
  // EVENT_SCOPED_ENTITIES não têm mais FK pra `events` (endereçadas por
  // aliasId, sem ON DELETE CASCADE possível) — por isso são apagadas
  // explicitamente aqui, mesmo padrão já usado pra EventMember.
  // ScheduleResource/ScheduleEntry/Team/CriterionJudgeAssignment saem
  // de graça via cascata das próprias FKs deles (scheduleDayId/
  // programId/judgeParticipationId), sem precisar de mais nada aqui.
  async deleteEvent(aliasId: string, userId: string): Promise<void> {
    const event = await this.getOwnEventOrThrow(aliasId, userId);

    await this.dataSource.transaction(async (manager) => {
      for (const entity of EVENT_SCOPED_ENTITIES) {
        await manager.delete(entity, { aliasId: event.aliasId });
      }
      await manager.delete(EventMember, { aliasId: event.aliasId });
      await manager.delete(Event, { aliasId: event.aliasId });
    });
    // Gravado depois da transação, fora dela: o log não tem FK pra
    // `events` (endereçado por aliasId, ver EventActivityLog) então
    // sobrevive de propósito à exclusão do evento — é histórico, não
    // dado do evento em si.
    await this.activityLogService.record(
      event.aliasId,
      userId,
      EventActivityAction.DELETED,
    );
  }

  async setEventLogo(aliasId: string, file: Express.Multer.File) {
    const event = await this.findEventOrThrow(aliasId);
    event.logoUrl = `/uploads/logos/${file.filename}`;
    return this.eventsRepo.save(event);
  }

  // Tela "Histórico" (acessível a partir do menu "⋯" da lista de
  // eventos da Home) — admin e assessor, mesmo par de papéis que já
  // pode editar as configurações do evento (ver updateEvent). Cobre
  // TODAS as versões do aliasId, não só a ativa (o log sobrevive a
  // republicações/exclusão, ver EventActivityLog).
  async getActivityLog(
    aliasId: string,
    userId: string,
  ): Promise<
    Array<{
      id: string;
      action: EventActivityAction;
      detail: string | null;
      actorName: string;
      createdAt: Date;
    }>
  > {
    const event = await this.getOwnEventOrThrow(aliasId, userId, [
      EventMemberRole.ADMIN,
      EventMemberRole.ASSESSOR,
    ]);
    const logs = await this.activityLogService.findForEvent(event.aliasId);
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      detail: log.detail,
      actorName: `${log.actor.firstName} ${log.actor.lastName}`.trim(),
      createdAt: log.createdAt,
    }));
  }

  // Liberação de notas/contestação/resultado pra equipe/atletas — ação
  // global do evento (ver ScoringService, que é quem chama isto a
  // partir de AdminScoringController). Cascata: ligar contestação liga
  // notas junto (não dá pra contestar sem poder ver a nota); desligar
  // notas desliga contestação junto. `resultsReleased` não participa
  // dessa cascata — resultado final é uma liberação independente das
  // outras duas (ver Event.resultsReleasedAt).
  async setReleaseFlags(
    aliasId: string,
    changes: {
      scoresReleased?: boolean;
      contestationReleased?: boolean;
      resultsReleased?: boolean;
    },
  ): Promise<Event> {
    const event = await this.findEventOrThrow(aliasId);
    // Guardado ANTES de mutar — só dispara notificação na transição
    // false -> true (liberar de verdade), nunca ao desligar nem ao
    // "reforçar" um valor que já estava ligado.
    const wasScoresReleased = !!event.scoresReleasedAt;
    const wasContestationReleased = !!event.contestationReleasedAt;
    const wasResultsReleased = !!event.resultsReleasedAt;

    if (changes.scoresReleased !== undefined) {
      event.scoresReleasedAt = changes.scoresReleased ? new Date() : null;
      if (!changes.scoresReleased) event.contestationReleasedAt = null;
    }
    if (changes.contestationReleased !== undefined) {
      event.contestationReleasedAt = changes.contestationReleased
        ? new Date()
        : null;
      if (changes.contestationReleased && !event.scoresReleasedAt) {
        event.scoresReleasedAt = new Date();
      }
    }
    if (changes.resultsReleased !== undefined) {
      event.resultsReleasedAt = changes.resultsReleased ? new Date() : null;
    }
    const saved = await this.eventsRepo.save(event);

    if (!wasScoresReleased && saved.scoresReleasedAt) {
      await this.notificationsService.create(
        saved.aliasId,
        NotificationType.SCORES_RELEASED,
        NotificationAudience.ALL,
        'Súmulas disponíveis',
      );
    }
    if (!wasContestationReleased && saved.contestationReleasedAt) {
      await this.notificationsService.create(
        saved.aliasId,
        NotificationType.CONTESTATION_RELEASED,
        NotificationAudience.ALL,
        'Período de contestação iniciado',
      );
    }
    if (!wasResultsReleased && saved.resultsReleasedAt) {
      await this.notificationsService.create(
        saved.aliasId,
        NotificationType.RESULTS_RELEASED,
        NotificationAudience.ALL,
        'Resultado disponível',
      );
    }

    return saved;
  }

  // Resolve o `aliasId` (identidade lógica estável do evento através das
  // republicações — não mais o `id` de uma versão específica, ver
  // "Endereçamento por aliasId nas rotas HTTP" no CLAUDE.md, 2026-07-27)
  // pra versão ATIVA — usado por praticamente todo domínio filho
  // (categories/programs/teams/judges/judging/schedule/regulations/
  // scoring/...) pra validar que o evento existe antes de criar/ler um
  // recurso vinculado a ele.
  async findEventOrThrow(aliasId: string): Promise<Event> {
    const event = await this.eventsRepo.findOneBy({ aliasId, active: true });
    if (!event) throw new NotFoundException('Evento não encontrado');
    return event;
  }

  // Resolve :eventId (aliasId) -> membership do usuário logado — usado
  // pelo EventMemberGuard, que decide o que fazer com `member: null`
  // (barra com 403). Não lança por conta própria (ao contrário de
  // getOwnEventOrThrow), porque quem chama pode querer tratar "sem
  // membership" de formas diferentes. O `event` retornado é usado por
  // alguns chamadores (ex.: ScoringService) pra ler campos da versão
  // ativa (`status`, `resultsReleasedAt`), não só `aliasId`.
  async getMemberForEventId(
    eventId: string,
    userId: string,
  ): Promise<{ event: Event; member: EventMember | null }> {
    const event = await this.findEventOrThrow(eventId);
    const member = await this.membersRepo.findOneBy({
      aliasId: event.aliasId,
      userId,
    });
    return { event, member };
  }

  // Público — reusado por EventStaffService pra achar a linha de uma
  // pessoa antes de criar/atualizar (mesma identidade: userId se já tem
  // conta, senão email case-insensitive).
  async findMemberByIdentity(
    aliasId: string,
    identity: { userId?: string | null; email: string },
  ): Promise<EventMember | null> {
    if (identity.userId) {
      return this.membersRepo.findOneBy({ aliasId, userId: identity.userId });
    }
    return this.membersRepo
      .createQueryBuilder('m')
      .where('m.aliasId = :aliasId', { aliasId })
      .andWhere('m.userId IS NULL')
      .andWhere('LOWER(m.email) = LOWER(:email)', { email: identity.email })
      .getOne();
  }

  // Upsert idempotente de UM papel na pessoa identificada por userId
  // (se já tem conta) ou por email (convite pendente) — usado pela
  // sincronia automática jurados -> roster (ver JudgesService).
  async upsertMemberRole(
    aliasId: string,
    role: EventMemberRole,
    identity: {
      userId?: string | null;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
    },
  ): Promise<void> {
    const existing = await this.findMemberByIdentity(aliasId, identity);
    if (existing) {
      if (!existing.roles.includes(role)) {
        existing.roles = [...existing.roles, role];
        await this.membersRepo.save(existing);
      }
      return;
    }
    const member = this.membersRepo.create({
      aliasId,
      userId: identity.userId ?? null,
      roles: [role],
      firstName: identity.firstName ?? null,
      lastName: identity.lastName ?? null,
      email: identity.email,
    });
    await this.membersRepo.save(member);
  }

  // Resgate de código/QR (ver Event.eventCode) — qualquer usuário
  // autenticado, sem exigir membership prévia (chamado de uma tela
  // pública, ver EventsController.joinByCode), ganha SPECTATOR no
  // evento. upsertMemberRole já é idempotente: se a pessoa já tiver
  // qualquer papel (inclusive admin/jurado), só acrescenta SPECTATOR
  // ao array — mesmo comportamento já aceito nos outros syncs
  // automáticos de papel (jurado/programa/atleta), inofensivo.
  async joinByCode(code: string, userId: string): Promise<EventWithRole> {
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const event = await this.eventsRepo.findOneBy({
      eventCode: normalized,
      active: true,
    });
    if (!event || !VISIBLE_TO_NON_STAFF.includes(event.status)) {
      throw new NotFoundException('Código de evento inválido.');
    }
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    await this.upsertMemberRole(event.aliasId, EventMemberRole.SPECTATOR, {
      userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    return this.attachRole(event, userId);
  }

  // Inverso de upsertMemberRole — tira `role` do roles[] da pessoa; se
  // não sobrar nenhum papel, remove a linha inteira.
  async removeMemberRole(
    aliasId: string,
    role: EventMemberRole,
    identity: { userId?: string | null; email: string },
  ): Promise<void> {
    const existing = await this.findMemberByIdentity(aliasId, identity);
    if (!existing) return;
    existing.roles = existing.roles.filter((r) => r !== role);
    if (existing.roles.length === 0) {
      await this.membersRepo.remove(existing);
    } else {
      await this.membersRepo.save(existing);
    }
  }

  // Todo aliasId onde `userId` tem `role` no roster — usado por
  // AthletesService.syncEventAccessForLink pra descobrir em quais
  // eventos um programa já participa (role=program) e replicar o
  // acesso ATHLETE pra um atleta recém-vinculado a ele, sem precisar de
  // dependência cruzada com ProgramsService (EventMember já é a fonte
  // de verdade de "esse programa está neste evento").
  async findAliasIdsForMemberRole(
    userId: string,
    role: EventMemberRole,
  ): Promise<string[]> {
    const rows = await this.membersRepo
      .createQueryBuilder('m')
      .select('DISTINCT m.aliasId', 'aliasId')
      .where('m.userId = :userId', { userId })
      .andWhere(':role = ANY(m.roles)', { role })
      .getRawMany<{ aliasId: string }>();
    return rows.map((r) => r.aliasId);
  }

  // Quantas pessoas o evento tem em cada papel do roster — alimenta os
  // cards "Jurados cadastrados"/"Programas cadastrados"/"Espectadores"/
  // "Atletas" do painel Início. Acesso amplo de propósito (não é uma
  // ação de gestão, só uma contagem) — quem chama decide o guard.
  async getMemberRoleCounts(
    aliasId: string,
  ): Promise<Partial<Record<EventMemberRole, number>>> {
    const event = await this.findEventOrThrow(aliasId);
    const rows = await this.membersRepo.query<
      Array<{ role: EventMemberRole; count: number }>
    >(
      `SELECT role, COUNT(*)::int AS count FROM event_members, unnest(roles) AS role WHERE alias_id = $1 GROUP BY role`,
      [event.aliasId],
    );
    const counts: Partial<Record<EventMemberRole, number>> = {};
    for (const row of rows) {
      counts[row.role] = row.count;
    }
    return counts;
  }

  // Chamado (incondicionalmente) por AuthService.setPassword: reclama
  // toda linha pendente (userId null) com esse email, em qualquer
  // evento — mesmo padrão de JudgesService.linkUnclaimedJudgesByEmail/
  // ProgramsService.linkUnclaimedProgramsByEmail, mas cobrindo qualquer
  // papel do roster (não só jurado).
  async linkUnclaimedMembersByEmail(
    userId: string,
    email: string,
  ): Promise<number> {
    const result = await this.membersRepo
      .createQueryBuilder()
      .update(EventMember)
      .set({ userId })
      .where('LOWER(email) = LOWER(:email)', { email })
      .andWhere('userId IS NULL')
      .execute();
    return result.affected ?? 0;
  }

  // Gera um Event.eventCode ainda não usado — tenta persistir dentro
  // da MESMA transação de publishEvent (via `manager`, não
  // `this.eventsRepo`) e, se colidir com o índice único parcial
  // (Postgres 23505), tenta de novo com outro candidato. Alfabeto de 8
  // caracteres (~32^8 combinações) torna uma colisão real quase
  // impossível — o retry é só rede de segurança.
  private async generateUniqueEventCode(
    manager: EntityManager,
  ): Promise<string> {
    const repo = manager.getRepository(Event);
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateEventCode();
      const exists = await repo.findOneBy({ eventCode: candidate });
      if (!exists) return candidate;
    }
    throw new ConflictException(
      'Não foi possível gerar um código único para o evento — tente publicar novamente.',
    );
  }

  private canSee(roles: EventMemberRole[], status: EventStatus): boolean {
    return (
      roles.some((r) => STAFF_ROLES.includes(r)) ||
      VISIBLE_TO_NON_STAFF.includes(status)
    );
  }

  // Usado por update/publish/start/complete/unpublish/delete: só quem
  // tem um dos papéis permitidos (por padrão só admin — publicar/
  // iniciar continuam restritos a admin; updateEvent/unpublishEvent/
  // completeEvent passam [ADMIN, ASSESSOR] explicitamente) pode mexer
  // no evento. `aliasId` já resolve direto pra versão ativa
  // (findEventOrThrow filtra `active: true`) — diferente de quando
  // este método recebia o `id` de uma versão específica, não precisa
  // mais checar `event.active` à parte aqui: uma linha antiga
  // simplesmente não é encontrável por `aliasId` (ela existe só como
  // histórico/auditoria, nunca como algo endereçável por esta rota).
  private async getOwnEventOrThrow(
    aliasId: string,
    userId: string,
    allowedRoles: EventMemberRole[] = [EventMemberRole.ADMIN],
  ): Promise<Event> {
    const event = await this.findEventOrThrow(aliasId);
    const member = await this.membersRepo.findOneBy({
      aliasId: event.aliasId,
      userId,
    });
    if (!member || !allowedRoles.some((r) => member.roles.includes(r))) {
      throw new ForbiddenException(
        'Só um administrador do evento pode fazer isso.',
      );
    }
    return event;
  }
}

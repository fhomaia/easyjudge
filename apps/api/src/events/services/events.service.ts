import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Event } from '../entities/event.entity';
import { EventMember } from '../entities/event-member.entity';
import { EventMemberRole } from '../enums/event-member-role.enum';
import { EventStatus } from '../enums/event-status.enum';
import { CreateEventDto } from '../dto/create-event.dto';
import { UpdateEventDto } from '../dto/update-event.dto';
import { stripUndefined } from '../../common/utils/strip-undefined';
import { UsersService } from '../../users/services/users.service';
import { Category } from '../../categories/entities/category.entity';
import { ProgramParticipation } from '../../programs/entities/program-participation.entity';
import { ScheduleDay } from '../../schedule/entities/schedule-day.entity';
import { Regulation } from '../../regulations/entities/regulation.entity';
import { JudgeParticipation } from '../../judges/entities/judge-participation.entity';
import { SpecialRoleAssignment } from '../../judging/entities/special-role-assignment.entity';

// Entidades filhas endereçadas diretamente pelo `id` da versão do
// evento (não pelo `aliasId` estável, ver comentário em `publishEvent`
// abaixo) — republicar precisa "adotar" essas linhas pra nova versão,
// senão elas ficam presas na versão antiga (agora inativa) e o evento
// publicado aparece "zerado" (0 categorias, 0 programas etc.) mesmo
// tendo todo o setup feito. `criterion_judge_assignments` e as tabelas
// de `schedule_resources`/`schedule_entries`/`teams` não têm `eventId`
// próprio — migram de graça por já dependerem, em cascata, de
// `scheduleDayId`/`programId`/`judgeParticipationId`, que por sua vez
// já apontam pra linhas cujo `eventId` é atualizado aqui.
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
// ordem de precedência.
const ROLE_PRECEDENCE = [
  EventMemberRole.ADMIN,
  EventMemberRole.ASSESSOR,
  EventMemberRole.JUDGE,
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
  ) {}

  // Cria a v1 do evento (aliasId = id, já que é a primeira versão) e o
  // membership de admin do criador, numa transação — as duas linhas
  // nascem juntas ou nenhuma nasce.
  async createEvent(dto: CreateEventDto, createdById: string): Promise<Event> {
    const id = randomUUID();
    const creator = await this.usersService.findById(createdById);
    return this.dataSource.transaction(async (manager) => {
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
  }

  // Lista só os eventos em que o usuário tem membership — admin/jurado
  // veem em qualquer status, assessor/espectador só em
  // published/started/completed. Cada evento vem com o(s) papel(is) do
  // próprio usuário anexado (currentUserRole/currentUserRoles), pro
  // frontend decidir quais ações (editar/iniciar/excluir) mostrar.
  async findAllForUser(userId: string): Promise<EventWithRole[]> {
    const { entities, raw } = await this.eventsRepo
      .createQueryBuilder('event')
      .loadRelationCountAndMap('event.categoriesCount', 'event.categories')
      .loadRelationCountAndMap('event.programsCount', 'event.programs')
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
      };
    });
  }

  async findOneForUser(id: string, userId: string): Promise<EventWithRole> {
    const event = await this.eventsRepo.findOne({
      where: { id },
      relations: ['categories', 'programs'],
    });
    if (!event) throw new NotFoundException('Evento não encontrado');

    const member = await this.membersRepo.findOneBy({
      aliasId: event.aliasId,
      userId,
    });
    if (!member || !this.canSee(member.roles, event.status)) {
      throw new ForbiddenException('Você não tem acesso a este evento');
    }

    return {
      ...event,
      currentUserRole: highestRole(member.roles),
      currentUserRoles: member.roles,
      categoriesCount: event.categories.length,
      programsCount: event.programs.length,
      categoriesUpdatedAt: latestUpdatedAt(event.categories),
      programsUpdatedAt: latestUpdatedAt(event.programs),
    };
  }

  // Edita a versão ativa no lugar (mesma linha/id/versão). Se o evento
  // estava publicado, editar o reverte pra "criado" automaticamente —
  // só uma nova publicação (ver publishEvent) registra uma versão nova.
  async updateEvent(
    id: string,
    dto: UpdateEventDto,
    userId: string,
  ): Promise<EventWithRole> {
    // Assessor também pode editar as configurações do evento (só não
    // mexe em acessos/pessoas nem no ciclo de vida — publicar/iniciar/
    // excluir continuam admin-only, ver os outros métodos abaixo).
    const event = await this.getOwnEventOrThrow(id, userId, [
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
    return this.attachRole(saved, userId);
  }

  // Publica (ou republica) o evento: desativa a versão atual e insere
  // uma nova linha com o mesmo aliasId e version + 1. As entidades
  // filhas (categorias, programas, regulamento, cronograma, jurados,
  // funções especiais — ver EVENT_SCOPED_ENTITIES) são "adotadas" pela
  // nova versão nessa mesma transação: elas são endereçadas pelo `id`
  // específico da versão (não pelo `aliasId`, ver gotcha de
  // versionamento no CLAUDE.md), então sem isso todo o setup do evento
  // ficaria preso na versão antiga (agora inativa) e o evento publicado
  // apareceria "zerado" — bug real reportado pelo usuário ("Easy Judge
  // Cup" com 0 programas e 0 categorias depois de publicar).
  async publishEvent(id: string, userId: string): Promise<EventWithRole> {
    const event = await this.getOwnEventOrThrow(id, userId);

    if (event.status !== EventStatus.CREATED) {
      throw new ConflictException(
        'Só é possível publicar um evento com status "criado".',
      );
    }

    const newVersion = await this.dataSource.transaction(async (manager) => {
      event.active = false;
      await manager.save(event);

      const newVersion = manager.create(Event, {
        name: event.name,
        startDate: event.startDate,
        competitionDays: event.competitionDays,
        location: event.location,
        logoUrl: event.logoUrl,
        createdById: event.createdById,
        id: randomUUID(),
        aliasId: event.aliasId,
        version: event.version + 1,
        active: true,
        status: EventStatus.PUBLISHED,
      });
      const saved = await manager.save(newVersion);

      for (const entity of EVENT_SCOPED_ENTITIES) {
        await manager.update(
          entity,
          { eventId: event.id },
          { eventId: saved.id },
        );
      }

      return saved;
    });
    return this.attachRole(newVersion, userId);
  }

  // Inicia o evento (published -> started) — transição de ciclo de
  // vida in-place, não versiona (diferente de publishEvent).
  async startEvent(id: string, userId: string): Promise<EventWithRole> {
    const event = await this.getOwnEventOrThrow(id, userId);

    if (event.status !== EventStatus.PUBLISHED) {
      throw new ConflictException('Só é possível iniciar um evento publicado.');
    }

    event.status = EventStatus.STARTED;
    const saved = await this.eventsRepo.save(event);
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
  // aliasId, não só a ativa, e todos os memberships. Categories/teams
  // de cada versão já saem junto via ON DELETE CASCADE na FK delas.
  async deleteEvent(id: string, userId: string): Promise<void> {
    const event = await this.getOwnEventOrThrow(id, userId);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(EventMember, { aliasId: event.aliasId });
      await manager.delete(Event, { aliasId: event.aliasId });
    });
  }

  async setEventLogo(id: string, file: Express.Multer.File) {
    const event = await this.findEventOrThrow(id);
    event.logoUrl = `/uploads/logos/${file.filename}`;
    return this.eventsRepo.save(event);
  }

  // Usado por CategoriesService e TeamsService para validar que o evento
  // existe antes de criar um recurso vinculado a ele.
  async findEventOrThrow(id: string): Promise<Event> {
    const event = await this.eventsRepo.findOneBy({ id });
    if (!event) throw new NotFoundException('Evento não encontrado');
    return event;
  }

  // Resolve :id (de uma versão específica) -> membership do usuário
  // logado — usado pelo EventMemberGuard, que decide o que fazer com
  // `member: null` (barra com 403). Não lança por conta própria (ao
  // contrário de getOwnEventOrThrow), porque quem chama pode querer
  // tratar "sem membership" de formas diferentes.
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

  private canSee(roles: EventMemberRole[], status: EventStatus): boolean {
    return (
      roles.some((r) => STAFF_ROLES.includes(r)) ||
      VISIBLE_TO_NON_STAFF.includes(status)
    );
  }

  // Usado por update/publish/start/delete: só quem tem um dos papéis
  // permitidos (por padrão só admin — publicar/iniciar/excluir
  // continuam restritos a admin; updateEvent passa [ADMIN, ASSESSOR]
  // explicitamente) pode mexer no evento, e só na versão ativa — uma
  // linha antiga (active=false) é histórico imutável, não dá pra
  // editar/publicar em cima dela (isso colidiria com o índice único de
  // "uma linha ativa por aliasId").
  private async getOwnEventOrThrow(
    id: string,
    userId: string,
    allowedRoles: EventMemberRole[] = [EventMemberRole.ADMIN],
  ): Promise<Event> {
    const event = await this.findEventOrThrow(id);
    if (!event.active) {
      throw new ConflictException(
        'Esta é uma versão antiga do evento — edite ou publique a versão atual.',
      );
    }
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

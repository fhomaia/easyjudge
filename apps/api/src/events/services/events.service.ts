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

// Participantes e espectadores só enxergam o evento nesses status;
// admin e jurado enxergam em qualquer status (inclusive rascunho).
const STAFF_ROLES = [EventMemberRole.ADMIN, EventMemberRole.JUDGE];
const VISIBLE_TO_NON_STAFF = [
  EventStatus.PUBLISHED,
  EventStatus.STARTED,
  EventStatus.COMPLETED,
];

// O papel do usuário logado NO evento — não é uma coluna de Event, é
// calculado por request (join com EventMember) e anexado na resposta
// pra o frontend saber se mostra ações de admin (editar/iniciar/excluir).
export type EventWithRole = Event & { currentUserRole: EventMemberRole };

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
  ) {}

  // Cria a v1 do evento (aliasId = id, já que é a primeira versão) e o
  // membership de admin do criador, numa transação — as duas linhas
  // nascem juntas ou nenhuma nasce.
  createEvent(dto: CreateEventDto, createdById: string): Promise<Event> {
    const id = randomUUID();
    return this.dataSource.transaction(async (manager) => {
      const event = manager.create(Event, {
        ...dto,
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
        role: EventMemberRole.ADMIN,
      });
      await manager.save(member);

      return saved;
    });
  }

  // Lista só os eventos em que o usuário tem membership — admin/jurado
  // veem em qualquer status, participante/espectador só em
  // published/started/completed. Cada evento vem com o papel do
  // próprio usuário anexado (currentUserRole), pro frontend decidir
  // quais ações (editar/iniciar/excluir) mostrar.
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
      .addSelect('member.role', 'member_role')
      .where('event.active = true')
      .andWhere(
        new Brackets((qb) => {
          qb.where('member.role IN (:...staffRoles)', {
            staffRoles: STAFF_ROLES,
          }).orWhere('event.status IN (:...visibleStatuses)', {
            visibleStatuses: VISIBLE_TO_NON_STAFF,
          });
        }),
      )
      .orderBy('event.createdAt', 'DESC')
      .getRawAndEntities();

    return entities.map((event, i) => ({
      ...event,
      currentUserRole: raw[i].member_role as EventMemberRole,
    }));
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
    if (!member || !this.canSee(member.role, event.status)) {
      throw new ForbiddenException('Você não tem acesso a este evento');
    }

    return {
      ...event,
      currentUserRole: member.role,
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
  ): Promise<Event> {
    const event = await this.getOwnEventOrThrow(id, userId);

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

    return this.eventsRepo.save(event);
  }

  // Publica (ou republica) o evento: desativa a versão atual e insere
  // uma nova linha com o mesmo aliasId e version + 1.
  async publishEvent(id: string, userId: string): Promise<Event> {
    const event = await this.getOwnEventOrThrow(id, userId);

    if (event.status !== EventStatus.CREATED) {
      throw new ConflictException(
        'Só é possível publicar um evento com status "criado".',
      );
    }

    return this.dataSource.transaction(async (manager) => {
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
      return manager.save(newVersion);
    });
  }

  // Inicia o evento (published -> started) — transição de ciclo de
  // vida in-place, não versiona (diferente de publishEvent).
  async startEvent(id: string, userId: string): Promise<Event> {
    const event = await this.getOwnEventOrThrow(id, userId);

    if (event.status !== EventStatus.PUBLISHED) {
      throw new ConflictException(
        'Só é possível iniciar um evento publicado.',
      );
    }

    event.status = EventStatus.STARTED;
    return this.eventsRepo.save(event);
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

  private canSee(role: EventMemberRole, status: EventStatus): boolean {
    return STAFF_ROLES.includes(role) || VISIBLE_TO_NON_STAFF.includes(status);
  }

  // Usado por update/publish: só quem é admin do evento pode editar seu
  // ciclo de vida, e só na versão ativa — uma linha antiga (active=false)
  // é histórico imutável, não dá pra editar/publicar em cima dela (isso
  // colidiria com o índice único de "uma linha ativa por aliasId").
  private async getOwnEventOrThrow(id: string, userId: string): Promise<Event> {
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
    if (!member || member.role !== EventMemberRole.ADMIN) {
      throw new ForbiddenException(
        'Só um administrador do evento pode fazer isso.',
      );
    }
    return event;
  }
}

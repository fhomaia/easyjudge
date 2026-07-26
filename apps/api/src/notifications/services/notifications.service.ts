import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationAudience } from '../enums/notification-audience.enum';
import { Event } from '../../events/entities/event.entity';
import { EventMember } from '../../events/entities/event-member.entity';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';

const STAFF_ROLES = [
  EventMemberRole.ADMIN,
  EventMemberRole.ASSESSOR,
  EventMemberRole.JUDGE,
];

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  scheduleEntryId: string | null;
  createdAt: string;
}

// Registra `Event`/`EventMember` diretamente (TypeOrmModule.forFeature no
// próprio NotificationsModule) em vez de importar EventsModule — evita
// ciclo, já que EventsModule importa NotificationsModule pra disparar
// notificação de liberação de notas/resultado/contestação (mesmo padrão
// já documentado no CLAUDE.md pra ScoringTemplatesModule/Category).
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepo: Repository<Notification>,
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(EventMember)
    private readonly membersRepo: Repository<EventMember>,
  ) {}

  // Chamado pelos outros services (EventsService/ScheduleService/
  // ScoringService) no exato momento em que o gatilho acontece — `title`
  // já vem formatado de quem chama (ver Notification, é um registro
  // histórico, não um template resolvido depois).
  async create(
    aliasId: string,
    type: NotificationType,
    audience: NotificationAudience,
    title: string,
    scheduleEntryId?: string,
  ): Promise<void> {
    await this.notificationsRepo.save(
      this.notificationsRepo.create({
        aliasId,
        type,
        audience,
        title,
        scheduleEntryId: scheduleEntryId ?? null,
      }),
    );
  }

  // Dedup — evita duplicar a mesma notificação se o gatilho rodar de
  // novo (reenvio idempotente da fila do jurado, retry de submitEvents
  // etc.). Usado antes de criar notificações ligadas a UMA apresentação
  // (presentation_completed/evaluation_pending/contestation_requested) —
  // as de evento inteiro já são naturalmente únicas (só disparam na
  // transição false->true da flag correspondente).
  async existsForEntry(
    aliasId: string,
    type: NotificationType,
    scheduleEntryId: string,
  ): Promise<boolean> {
    const count = await this.notificationsRepo.count({
      where: { aliasId, type, scheduleEntryId },
    });
    return count > 0;
  }

  async listForUser(
    eventId: string,
    userId: string,
  ): Promise<{ notifications: NotificationView[]; unreadCount: number }> {
    const { aliasId, member } = await this.resolveMemberOrThrow(
      eventId,
      userId,
    );
    const audiences = this.audiencesForMember(member);

    const rows = await this.notificationsRepo.find({
      where: audiences.map((audience) => ({ aliasId, audience })),
      order: { createdAt: 'DESC' },
      take: 50,
    });

    const unreadCount = member.notificationsSeenAt
      ? rows.filter((r) => r.createdAt > member.notificationsSeenAt!).length
      : rows.length;

    return {
      notifications: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        scheduleEntryId: r.scheduleEntryId,
        createdAt: r.createdAt.toISOString(),
      })),
      unreadCount,
    };
  }

  async markSeen(eventId: string, userId: string): Promise<void> {
    const { member } = await this.resolveMemberOrThrow(eventId, userId);
    member.notificationsSeenAt = new Date();
    await this.membersRepo.save(member);
  }

  private audiencesForMember(member: EventMember): NotificationAudience[] {
    const isStaff = STAFF_ROLES.some((r) => member.roles.includes(r));
    return isStaff
      ? [NotificationAudience.ALL, NotificationAudience.STAFF]
      : [NotificationAudience.ALL];
  }

  private async resolveMemberOrThrow(
    eventId: string,
    userId: string,
  ): Promise<{ aliasId: string; member: EventMember }> {
    const event = await this.eventsRepo.findOneBy({ id: eventId });
    if (!event) throw new ForbiddenException('Evento não encontrado.');
    const member = await this.membersRepo.findOneBy({
      aliasId: event.aliasId,
      userId,
    });
    if (!member) {
      throw new ForbiddenException(
        'Você não tem permissão para isso neste evento.',
      );
    }
    return { aliasId: event.aliasId, member };
  }
}

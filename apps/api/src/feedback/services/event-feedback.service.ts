import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EventFeedback } from '../entities/event-feedback.entity';
import { EventFeedbackDto } from '../dto/feedback.dto';
import { EventsService } from '../../events/services/events.service';
import { EventMember } from '../../events/entities/event-member.entity';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import { EventStatus } from '../../events/enums/event-status.enum';

// Quem organiza não avalia o próprio evento: ter papel de admin ou
// assessor barra, mesmo acumulando outro (ex. admin que também é
// jurado). Jurado, programa, atleta e espectador avaliam.
const ORGANIZER_ROLES = [EventMemberRole.ADMIN, EventMemberRole.ASSESSOR];

export interface EventFeedbackItemView {
  id: string;
  userName: string;
  userEmail: string;
  roles: EventMemberRole[];
  rating: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackSummaryView {
  count: number;
  average: number | null;
  // Quantidade por nota, índice 0 = 1 estrela ... 4 = 5 estrelas.
  distribution: number[];
}

export function summarize(ratings: number[]): FeedbackSummaryView {
  const distribution = [0, 0, 0, 0, 0];
  for (const r of ratings) distribution[r - 1] += 1;
  return {
    count: ratings.length,
    average: ratings.length
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : null,
    distribution,
  };
}

@Injectable()
export class EventFeedbackService {
  constructor(
    @InjectRepository(EventFeedback)
    private readonly feedbackRepo: Repository<EventFeedback>,
    @InjectRepository(EventMember)
    private readonly membersRepo: Repository<EventMember>,
    private readonly eventsService: EventsService,
  ) {}

  async getMine(eventId: string, userId: string) {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const row = await this.feedbackRepo.findOneBy({
      aliasId: event.aliasId,
      userId,
    });
    return row
      ? { rating: row.rating, comment: row.comment, updatedAt: row.updatedAt }
      : null;
  }

  async saveMine(eventId: string, userId: string, dto: EventFeedbackDto) {
    const { event, member } = await this.eventsService.getMemberForEventId(
      eventId,
      userId,
    );
    // Disponível a todo momento depois de publicado (pedido do usuário).
    if (event.status === EventStatus.CREATED) {
      throw new BadRequestException(
        'A avaliação fica disponível depois que o evento é publicado.',
      );
    }
    if (!member || member.roles.some((r) => ORGANIZER_ROLES.includes(r))) {
      throw new ForbiddenException('Quem organiza o evento não o avalia.');
    }
    const comment = dto.comment?.trim() || null;
    const existing = await this.feedbackRepo.findOneBy({
      aliasId: event.aliasId,
      userId,
    });
    const row =
      existing ?? this.feedbackRepo.create({ aliasId: event.aliasId, userId });
    row.rating = dto.rating;
    row.comment = comment;
    const saved = await this.feedbackRepo.save(row);
    return {
      rating: saved.rating,
      comment: saved.comment,
      updatedAt: saved.updatedAt,
    };
  }

  async listForEvent(eventId: string): Promise<{
    summary: FeedbackSummaryView;
    items: EventFeedbackItemView[];
  }> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const rows = await this.feedbackRepo.find({
      where: { aliasId: event.aliasId },
      relations: ['user'],
      order: { updatedAt: 'DESC' },
    });
    const members = rows.length
      ? await this.membersRepo.find({
          where: {
            aliasId: event.aliasId,
            userId: In(rows.map((r) => r.userId)),
          },
        })
      : [];
    const rolesByUser = new Map(members.map((m) => [m.userId, m.roles]));
    return {
      summary: summarize(rows.map((r) => r.rating)),
      items: rows.map((r) => ({
        id: r.id,
        userName:
          `${r.user.firstName} ${r.user.lastName ?? ''}`.trim() || r.user.email,
        userEmail: r.user.email,
        roles: rolesByUser.get(r.userId) ?? [],
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    };
  }
}

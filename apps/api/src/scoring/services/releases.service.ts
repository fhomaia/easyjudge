import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryDayRelease } from '../entities/category-day-release.entity';
import { EventsService } from '../../events/services/events.service';
import {
  ScheduleService,
  type ScheduleDayView,
} from '../../schedule/services/schedule.service';
import { ScheduleEntryType } from '../../schedule/enums/schedule-entry-type.enum';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/enums/notification-type.enum';
import { NotificationAudience } from '../../notifications/enums/notification-audience.enum';

export type ReleaseKind = 'scores' | 'contestation' | 'results';

export interface ReleaseCategoryView {
  categoryId: string;
  categoryName: string;
  presentationCount: number;
  scoresReleased: boolean;
  contestationReleased: boolean;
  resultsReleased: boolean;
}

// Um dia do cronograma com apresentação. As 3 chaves do dia valem
// "todas as categorias deste dia estão liberadas" (ver setRelease).
export interface ReleaseDayView {
  dayId: string;
  date: string;
  dayIndex: number;
  scoresReleased: boolean;
  contestationReleased: boolean;
  resultsReleased: boolean;
  categories: ReleaseCategoryView[];
}

export interface ReleaseChanges {
  scoresReleased?: boolean;
  contestationReleased?: boolean;
  resultsReleased?: boolean;
}

// Consulta rápida pra quem precisa decidir se uma apresentação pode ser
// mostrada (ver ScoringService): chave `${dayId}|${categoryId}`.
export class ReleaseMap {
  constructor(private readonly rows: Map<string, CategoryDayRelease>) {}

  static key(dayId: string, categoryId: string) {
    return `${dayId}|${categoryId}`;
  }

  isReleased(dayId: string, categoryId: string, kind: ReleaseKind): boolean {
    const row = this.rows.get(ReleaseMap.key(dayId, categoryId));
    if (!row) return false;
    if (kind === 'scores') return !!row.scoresReleasedAt;
    if (kind === 'contestation') return !!row.contestationReleasedAt;
    return !!row.resultsReleasedAt;
  }
}

// Categorias com apresentação em cada dia, na ordem da primeira
// aparição no cronograma. Dia sem apresentação não entra.
export function presentationCategoriesByDay(days: ScheduleDayView[]) {
  const result: Array<{
    day: ScheduleDayView;
    categories: Array<{ id: string; name: string; count: number }>;
  }> = [];
  for (const day of days) {
    const byId = new Map<string, { id: string; name: string; count: number }>();
    for (const resource of day.resources) {
      for (const entry of resource.entries) {
        if (entry.type !== ScheduleEntryType.PRESENTATION || !entry.categoryId)
          continue;
        const current = byId.get(entry.categoryId) ?? {
          id: entry.categoryId,
          name: entry.categoryName ?? '',
          count: 0,
        };
        current.count += 1;
        byId.set(entry.categoryId, current);
      }
    }
    if (byId.size > 0) result.push({ day, categories: [...byId.values()] });
  }
  return result;
}

// Liberação de notas/contestação/resultado por categoria em cada dia
// (2026-09-24, substitui as 3 chaves globais do evento). Regras entre
// as chaves, as mesmas que já valiam pro evento inteiro: liberar
// contestação libera as notas junto (não dá pra contestar sem ver a
// nota); fechar as notas fecha a contestação junto. Resultado é
// independente das outras duas.
@Injectable()
export class ReleasesService {
  constructor(
    @InjectRepository(CategoryDayRelease)
    private readonly releasesRepo: Repository<CategoryDayRelease>,
    private readonly eventsService: EventsService,
    private readonly scheduleService: ScheduleService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getReleaseMap(eventId: string): Promise<ReleaseMap> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const rows = await this.releasesRepo.find({
      where: { aliasId: event.aliasId },
    });
    return new ReleaseMap(
      new Map(
        rows.map((r) => [ReleaseMap.key(r.scheduleDayId, r.categoryId), r]),
      ),
    );
  }

  // Liberação de uma apresentação específica (dia vem do recurso dela).
  async isEntryReleased(
    eventId: string,
    entry: { resourceId: string; categoryId: string | null },
    kind: ReleaseKind,
  ): Promise<boolean> {
    if (!entry.categoryId) return false;
    const resource = await this.scheduleService.findResourceInEventOrThrow(
      eventId,
      entry.resourceId,
    );
    const row = await this.releasesRepo.findOneBy({
      scheduleDayId: resource.scheduleDayId,
      categoryId: entry.categoryId,
    });
    if (!row) return false;
    if (kind === 'scores') return !!row.scoresReleasedAt;
    if (kind === 'contestation') return !!row.contestationReleasedAt;
    return !!row.resultsReleasedAt;
  }

  async getReleaseState(
    eventId: string,
    days?: ScheduleDayView[],
  ): Promise<ReleaseDayView[]> {
    const scheduleDays = days ?? (await this.scheduleService.getDays(eventId));
    const map = await this.getReleaseMap(eventId);
    return presentationCategoriesByDay(scheduleDays).map(
      ({ day, categories }) => {
        const views: ReleaseCategoryView[] = categories.map((c) => ({
          categoryId: c.id,
          categoryName: c.name,
          presentationCount: c.count,
          scoresReleased: map.isReleased(day.id, c.id, 'scores'),
          contestationReleased: map.isReleased(day.id, c.id, 'contestation'),
          resultsReleased: map.isReleased(day.id, c.id, 'results'),
        }));
        return {
          dayId: day.id,
          date: day.date,
          dayIndex: day.dayIndex,
          scoresReleased: views.every((v) => v.scoresReleased),
          contestationReleased: views.every((v) => v.contestationReleased),
          resultsReleased: views.every((v) => v.resultsReleased),
          categories: views,
        };
      },
    );
  }

  // Sem `categoryId` = todas as categorias com apresentação no dia (a
  // chave do dia). Notifica só o que passou de fechado pra liberado.
  async setRelease(
    eventId: string,
    scope: { dayId: string; categoryId?: string },
    changes: ReleaseChanges,
  ): Promise<ReleaseDayView[]> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const days = await this.scheduleService.getDays(eventId);
    const dayGroup = presentationCategoriesByDay(days).find(
      (g) => g.day.id === scope.dayId,
    );
    if (!dayGroup) {
      throw new BadRequestException(
        'Este dia não tem apresentações pra liberar.',
      );
    }
    const targets = scope.categoryId
      ? dayGroup.categories.filter((c) => c.id === scope.categoryId)
      : dayGroup.categories;
    if (targets.length === 0) {
      throw new BadRequestException(
        'Esta categoria não se apresenta neste dia.',
      );
    }

    const existing = await this.releasesRepo.find({
      where: { scheduleDayId: scope.dayId },
    });
    const byCategory = new Map(existing.map((r) => [r.categoryId, r]));
    const newly: Record<ReleaseKind, string[]> = {
      scores: [],
      contestation: [],
      results: [],
    };
    const now = new Date();
    const toSave: CategoryDayRelease[] = [];

    for (const category of targets) {
      const row =
        byCategory.get(category.id) ??
        this.releasesRepo.create({
          aliasId: event.aliasId,
          scheduleDayId: scope.dayId,
          categoryId: category.id,
          scoresReleasedAt: null,
          contestationReleasedAt: null,
          resultsReleasedAt: null,
        });
      const was = {
        scores: !!row.scoresReleasedAt,
        contestation: !!row.contestationReleasedAt,
        results: !!row.resultsReleasedAt,
      };

      if (changes.scoresReleased !== undefined) {
        row.scoresReleasedAt = changes.scoresReleased
          ? (row.scoresReleasedAt ?? now)
          : null;
        if (!changes.scoresReleased) row.contestationReleasedAt = null;
      }
      if (changes.contestationReleased !== undefined) {
        row.contestationReleasedAt = changes.contestationReleased
          ? (row.contestationReleasedAt ?? now)
          : null;
        if (changes.contestationReleased && !row.scoresReleasedAt) {
          row.scoresReleasedAt = now;
        }
      }
      if (changes.resultsReleased !== undefined) {
        row.resultsReleasedAt = changes.resultsReleased
          ? (row.resultsReleasedAt ?? now)
          : null;
      }

      if (!was.scores && row.scoresReleasedAt) newly.scores.push(category.name);
      if (!was.contestation && row.contestationReleasedAt)
        newly.contestation.push(category.name);
      if (!was.results && row.resultsReleasedAt)
        newly.results.push(category.name);
      toSave.push(row);
    }
    await this.releasesRepo.save(toSave);

    const notices: Array<[ReleaseKind, NotificationType, string]> = [
      ['scores', NotificationType.SCORES_RELEASED, 'Súmulas disponíveis'],
      [
        'contestation',
        NotificationType.CONTESTATION_RELEASED,
        'Período de contestação iniciado',
      ],
      ['results', NotificationType.RESULTS_RELEASED, 'Resultado disponível'],
    ];
    for (const [kind, type, label] of notices) {
      if (newly[kind].length === 0) continue;
      await this.notificationsService.create(
        event.aliasId,
        type,
        NotificationAudience.ALL,
        `${label}: ${describeCategories(newly[kind])}`,
      );
    }

    return this.getReleaseState(eventId, days);
  }
}

function describeCategories(names: string[]): string {
  if (names.length <= 2) return names.join(' e ');
  return `${names.slice(0, 2).join(', ')} e mais ${names.length - 2}`;
}

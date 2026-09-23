import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { CategoryFormat } from '../../categories/enums/category-format.enum';
import { ScheduleEntry } from '../../schedule/entities/schedule-entry.entity';
import { ScheduleEntryType } from '../../schedule/enums/schedule-entry-type.enum';
import { EventsService } from '../../events/services/events.service';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import { ProgramsService } from '../../programs/services/programs.service';

export interface EventMetricsBar {
  label: string;
  count: number;
}

export interface EventMetricsFormatBar {
  formatKey: string;
  count: number;
}

export interface EventMetricsResponse {
  categoriesCount: number;
  teamsCount: number;
  programsCount: number;
  presentationsCount: number;
  judgesCount: number;
  athletesCount: number;
  spectatorsCount: number;
  teamsByProgram: EventMetricsBar[];
  presentationsByCategory: EventMetricsBar[];
  categoriesByFormat: EventMetricsFormatBar[];
  programsByState: EventMetricsBar[];
}

// Cópia local da mesma prioridade de formato usada em
// DEFAULT_AUTO_FORMAT_ORDER (schedule)/MODALITY_DISPLAY_ORDER (scoring)
// — não importada de lá pra não acoplar este domínio a schedule/scoring
// só por uma lista de 4 itens (mesmo raciocínio já documentado nesses
// dois lugares).
const FORMAT_DISPLAY_ORDER: CategoryFormat[] = [
  CategoryFormat.TEAM_CHEER,
  CategoryFormat.GROUP_STUNT,
  CategoryFormat.COED,
  CategoryFormat.PARTNER,
];

function formatKeyFor(category: Category): string {
  return category.categoryFormat === CategoryFormat.CUSTOM
    ? `custom:${category.customFormatLabel ?? ''}`
    : category.categoryFormat;
}

function formatOrderIndex(category: Category): number {
  const idx = FORMAT_DISPLAY_ORDER.indexOf(category.categoryFormat);
  return idx === -1 ? FORMAT_DISPLAY_ORDER.length : idx;
}

// Tela "Métricas do evento" (menu "⋯" da listagem, ver
// EventActionsMenu/EventMetricsPage no frontend) — puramente leitura
// agregada pra admin/assessor. Reaproveita ProgramsService.
// findAllForEvent (já resolve ProgramProfile/teamsCount, ver
// ProgramsService.toProgramView) e EventsService.getMemberRoleCounts em
// vez de duplicar essa lógica com repositórios próprios; só
// Category/ScheduleEntry precisam de acesso direto, sem método pronto
// pra reusar (mesmo padrão de acesso direto a repositório já usado por
// EventsModule/ScoringModule pra evitar importar o domínio inteiro).
@Injectable()
export class EventMetricsService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    @InjectRepository(ScheduleEntry)
    private readonly entriesRepo: Repository<ScheduleEntry>,
    private readonly eventsService: EventsService,
    private readonly programsService: ProgramsService,
  ) {}

  async getEventMetrics(eventId: string): Promise<EventMetricsResponse> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const aliasId = event.aliasId;

    const [categories, programs, presentationRows, roleCounts] =
      await Promise.all([
        this.categoriesRepo.find({ where: { aliasId } }),
        this.programsService.findAllForEvent(aliasId),
        this.entriesRepo
          .createQueryBuilder('entry')
          .innerJoin('entry.category', 'category')
          .where('category.aliasId = :aliasId', { aliasId })
          .andWhere('entry.type = :type', {
            type: ScheduleEntryType.PRESENTATION,
          })
          .andWhere('entry.withdrawnAt IS NULL')
          .select('entry.categoryId', 'categoryId')
          .addSelect('category.name', 'categoryName')
          .addSelect('COUNT(*)::int', 'count')
          .groupBy('entry.categoryId')
          .addGroupBy('category.name')
          .getRawMany<{
            categoryId: string;
            categoryName: string;
            count: number;
          }>(),
        this.eventsService.getMemberRoleCounts(aliasId),
      ]);

    const teamsByProgram = programs
      .map((p) => ({ label: p.name, count: p.teamsCount ?? 0 }))
      .filter((p) => p.count > 0)
      .sort((a, b) => b.count - a.count);
    const teamsCount = teamsByProgram.reduce((sum, p) => sum + p.count, 0);

    const stateCounts = new Map<string, number>();
    for (const p of programs) {
      const key = p.state?.trim().toUpperCase() || 'Não informado';
      stateCounts.set(key, (stateCounts.get(key) ?? 0) + 1);
    }
    const programsByState = [...stateCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const presentationsByCategory = presentationRows
      .map((row) => ({ label: row.categoryName, count: row.count }))
      .sort((a, b) => b.count - a.count);
    const presentationsCount = presentationRows.reduce(
      (sum, row) => sum + row.count,
      0,
    );

    const formatGroups = new Map<string, { count: number; order: number }>();
    for (const category of categories) {
      const key = formatKeyFor(category);
      const existing = formatGroups.get(key);
      if (existing) existing.count += 1;
      else formatGroups.set(key, { count: 1, order: formatOrderIndex(category) });
    }
    const categoriesByFormat = [...formatGroups.entries()]
      .map(([formatKey, v]) => ({ formatKey, count: v.count, order: v.order }))
      .sort(
        (a, b) => a.order - b.order || a.formatKey.localeCompare(b.formatKey, 'pt-BR'),
      )
      .map(({ formatKey, count }) => ({ formatKey, count }));

    return {
      categoriesCount: categories.length,
      teamsCount,
      programsCount: programs.length,
      presentationsCount,
      judgesCount: roleCounts[EventMemberRole.JUDGE] ?? 0,
      athletesCount: roleCounts[EventMemberRole.ATHLETE] ?? 0,
      spectatorsCount: roleCounts[EventMemberRole.SPECTATOR] ?? 0,
      teamsByProgram,
      presentationsByCategory,
      categoriesByFormat,
      programsByState,
    };
  }
}

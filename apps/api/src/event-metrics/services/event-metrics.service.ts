import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../../teams/entities/team.entity';
import { Category } from '../../categories/entities/category.entity';
import { ScheduleEntry } from '../../schedule/entities/schedule-entry.entity';
import { ScheduleEntryType } from '../../schedule/enums/schedule-entry-type.enum';
import { CategoryFormat } from '../../categories/enums/category-format.enum';
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

export interface EventMetricsLevelBar {
  level: number;
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
  categoriesByProgram: EventMetricsBar[];
  presentationsByModality: EventMetricsFormatBar[];
  presentationsByLevel: EventMetricsLevelBar[];
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

function formatKeyFor(
  categoryFormat: CategoryFormat,
  customFormatLabel: string | null,
): string {
  return categoryFormat === CategoryFormat.CUSTOM
    ? `custom:${customFormatLabel ?? ''}`
    : categoryFormat;
}

function formatOrderIndex(categoryFormat: CategoryFormat): number {
  const idx = FORMAT_DISPLAY_ORDER.indexOf(categoryFormat);
  return idx === -1 ? FORMAT_DISPLAY_ORDER.length : idx;
}

interface PresentationRow {
  categoryId: string;
  categoryFormat: CategoryFormat;
  customFormatLabel: string | null;
  level: number;
  count: number;
}

// Tela "Métricas do evento" (menu "⋯" da listagem, ver
// EventActionsMenu/EventMetricsPage no frontend) — puramente leitura
// agregada pra admin/assessor. Reaproveita ProgramsService.
// findAllForEvent (já resolve ProgramProfile/teamsCount) e
// EventsService.getMemberRoleCounts em vez de duplicar essa lógica; só
// Team/ScheduleEntry precisam de acesso direto a repositório (mesmo
// padrão já usado em events.module.ts/scoring.module.ts pra evitar
// importar TeamsModule/ScheduleModule inteiros só por isso).
@Injectable()
export class EventMetricsService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    @InjectRepository(Team)
    private readonly teamsRepo: Repository<Team>,
    @InjectRepository(ScheduleEntry)
    private readonly entriesRepo: Repository<ScheduleEntry>,
    private readonly eventsService: EventsService,
    private readonly programsService: ProgramsService,
  ) {}

  async getEventMetrics(eventId: string): Promise<EventMetricsResponse> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const aliasId = event.aliasId;

    const [categoriesCount, programs, categoryProgramRows, presentationRows, roleCounts] =
      await Promise.all([
        this.categoriesRepo.count({ where: { aliasId } }),
        this.programsService.findAllForEvent(eventId),
        this.teamsRepo
          .createQueryBuilder('team')
          .innerJoin('team.program', 'program')
          .innerJoin('team.categories', 'category')
          .where('program.aliasId = :aliasId', { aliasId })
          .select('program.id', 'programId')
          .addSelect('program.name', 'programName')
          .addSelect('COUNT(DISTINCT category.id)::int', 'count')
          .groupBy('program.id')
          .addGroupBy('program.name')
          .getRawMany<{ programId: string; programName: string; count: number }>(),
        this.entriesRepo
          .createQueryBuilder('entry')
          .innerJoin('entry.category', 'category')
          .where('category.aliasId = :aliasId', { aliasId })
          .andWhere('entry.type = :type', {
            type: ScheduleEntryType.PRESENTATION,
          })
          .andWhere('entry.withdrawnAt IS NULL')
          .select('entry.categoryId', 'categoryId')
          .addSelect('category.categoryFormat', 'categoryFormat')
          .addSelect('category.customFormatLabel', 'customFormatLabel')
          .addSelect('category.level', 'level')
          .addSelect('COUNT(*)::int', 'count')
          .groupBy('entry.categoryId')
          .addGroupBy('category.categoryFormat')
          .addGroupBy('category.customFormatLabel')
          .addGroupBy('category.level')
          .getRawMany<PresentationRow>(),
        this.eventsService.getMemberRoleCounts(aliasId),
      ]);

    const teamsCount = programs.reduce((sum, p) => sum + (p.teamsCount ?? 0), 0);

    const categoriesByProgram = categoryProgramRows
      .map((row) => ({ label: row.programName, count: row.count }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);

    const stateCounts = new Map<string, number>();
    for (const p of programs) {
      const key = p.state?.trim().toUpperCase() || 'Não informado';
      stateCounts.set(key, (stateCounts.get(key) ?? 0) + 1);
    }
    const programsByState = [...stateCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const presentationsCount = presentationRows.reduce(
      (sum, row) => sum + row.count,
      0,
    );

    const modalityGroups = new Map<string, { count: number; order: number }>();
    for (const row of presentationRows) {
      const key = formatKeyFor(row.categoryFormat, row.customFormatLabel);
      const existing = modalityGroups.get(key);
      if (existing) existing.count += row.count;
      else
        modalityGroups.set(key, {
          count: row.count,
          order: formatOrderIndex(row.categoryFormat),
        });
    }
    const presentationsByModality = [...modalityGroups.entries()]
      .map(([formatKey, v]) => ({ formatKey, count: v.count, order: v.order }))
      .sort(
        (a, b) => a.order - b.order || a.formatKey.localeCompare(b.formatKey, 'pt-BR'),
      )
      .map(({ formatKey, count }) => ({ formatKey, count }));

    // Nível é ordinal (1 a 7, aceita meio-nível) — ordenado de forma
    // crescente pelo próprio nível, não por magnitude (diferente dos
    // outros gráficos de ranking desta tela), já que trocar a ordem
    // aqui mudaria o sentido dos dados.
    const levelGroups = new Map<number, number>();
    for (const row of presentationRows) {
      const level = Number(row.level);
      levelGroups.set(level, (levelGroups.get(level) ?? 0) + row.count);
    }
    const presentationsByLevel = [...levelGroups.entries()]
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => a.level - b.level);

    return {
      categoriesCount,
      teamsCount,
      programsCount: programs.length,
      presentationsCount,
      judgesCount: roleCounts[EventMemberRole.JUDGE] ?? 0,
      athletesCount: roleCounts[EventMemberRole.ATHLETE] ?? 0,
      spectatorsCount: roleCounts[EventMemberRole.SPECTATOR] ?? 0,
      categoriesByProgram,
      presentationsByModality,
      presentationsByLevel,
      programsByState,
    };
  }
}

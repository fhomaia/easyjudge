import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { ScoreEvent } from '../entities/score-event.entity';
import { ScoreEventKind } from '../enums/score-event-kind.enum';
import { ScoreEventInputDto } from '../dto/score-event-input.dto';
import { Category } from '../../categories/entities/category.entity';
import { CategoryFormat } from '../../categories/enums/category-format.enum';
import { Team } from '../../teams/entities/team.entity';
import { ScoringCriterion } from '../../scoring-templates/entities/scoring-criterion.entity';
import { ScoringCriterionType } from '../../scoring-templates/enums/scoring-criterion-type.enum';
import { ScheduleEntryType } from '../../schedule/enums/schedule-entry-type.enum';
import { JudgesService } from '../../judges/services/judges.service';
import { JudgingService } from '../../judging/services/judging.service';
import type { CriterionAssignmentsState } from '../../judging/services/judging.service';
import { SpecialJudgeRole } from '../../judging/enums/special-judge-role.enum';
import { ScheduleService } from '../../schedule/services/schedule.service';
import { EventsService } from '../../events/services/events.service';
import { ProgramsService } from '../../programs/services/programs.service';
import { ScoringCriteriaService } from '../../scoring-templates/services/scoring-criteria.service';
import { DeductionType } from '../../regulations/enums/deduction-type.enum';
import {
  RegulationsService,
  type DeductionRuleView,
} from '../../regulations/services/regulations.service';

export interface ScoringCriterionView {
  id: string;
  name: string;
  description: string | null;
  maxScore: number;
  allowDecimalScoring: boolean;
  order: number;
}

export interface ScoringGroupView {
  id: string;
  name: string;
  criteria: ScoringCriterionView[];
}

export interface ScoringSheetView {
  presentation: {
    id: string;
    teamName: string;
    categoryName: string;
    resourceId: string;
    resourceName: string;
    presentationTimeSeconds: number | null;
  };
  groups: ScoringGroupView[];
  isLegalityJudge: boolean;
  isHeadJudge: boolean;
  deductions: DeductionRuleView[];
  events: ScoreEvent[];
  contestationRequested: boolean;
  contestationResolved: boolean;
}

// Painel Head Judge (Modo Supervisão) — visão do Head Judge sobre TODOS
// os jurados escalados na apresentação atual, não só a própria folha.

export type HeadJudgeRosterEntryStatus = 'complete' | 'incomplete';

export interface HeadJudgeRosterEntryView {
  judgeParticipationId: string;
  name: string;
  groups: string[];
  specialRoles: SpecialJudgeRole[];
  status: HeadJudgeRosterEntryStatus;
}

export interface HeadJudgeRosterView {
  team: { id: string; name: string };
  judges: HeadJudgeRosterEntryView[];
}

export interface HeadJudgeSheetView extends ScoringSheetView {
  judge: { id: string; name: string };
}

export interface HeadJudgeLogEntryView {
  id: string;
  kind: ScoreEventKind;
  judgeParticipationId: string;
  judgeName: string;
  actingJudgeParticipationId: string | null;
  actingJudgeName: string | null;
  criterionId: string | null;
  criterionName: string | null;
  value: number | null;
  deductionType: DeductionType | null;
  undoesEventId: string | null;
  clientCreatedAt: Date;
}

// Visão do admin/assessor (leitura, sem poder de edição) e da equipe
// dona (Programa, só depois de liberado) sobre UMA apresentação — ao
// contrário do Painel Head Judge (que mostra a folha de um jurado por
// vez), aqui todos os grupos + legalidade aparecem JUNTOS, cada
// critério com o nome do jurado responsável (ver
// ScoringService.buildPresentationDetail).

export interface AdminOverviewEntryView {
  scheduleEntryId: string;
  teamName: string;
  categoryName: string;
  resourceName: string;
  dayDate: string;
  // scoresReleased/contestationReleased NÃO ficam mais aqui — viraram
  // ação global do evento (ver ReleaseFlagsView/getReleaseFlags), não
  // faz mais sentido repetir o mesmo valor em toda linha da lista.
  contestationRequested: boolean;
}

// Liberação global do evento — "Liberar notas"/"Liberar contestação"/
// "Liberar resultado", um switch só por evento (ver
// EventsService.setReleaseFlags pela cascata entre os dois primeiros).
export interface ReleaseFlagsView {
  scoresReleased: boolean;
  contestationReleased: boolean;
  resultsReleased: boolean;
}

export interface PresentationDetailCriterionView extends ScoringCriterionView {
  value: number | null;
  judgeName: string;
}

export interface PresentationDetailGroupView {
  id: string;
  name: string;
  criteria: PresentationDetailCriterionView[];
}

export interface PresentationDetailLegalityView {
  judgeName: string;
  deductions: Array<{
    type: DeductionType;
    value: number;
    presentationElapsedMs: number | null;
    clientCreatedAt: Date;
  }>;
}

export interface PresentationDetailNoteView {
  judgeName: string;
  comment: string;
}

export interface PresentationDetailView {
  presentation: {
    id: string;
    teamName: string;
    categoryName: string;
    resourceName: string;
  };
  groups: PresentationDetailGroupView[];
  legality: PresentationDetailLegalityView | null;
  notes: PresentationDetailNoteView[];
  scoresReleased: boolean;
  contestationReleased: boolean;
  contestationRequested: boolean;
}

// Página de Resultados (produtor/admin) — agregação read-only sobre as
// mesmas apresentações "100% pontuadas" já usadas em getAdminOverview,
// só que aqui calculamos nota final/percentual de cada uma pra rankear
// por categoria, por equipe (cross-categoria) e por programa. Não
// depende de `resultsReleasedAt` (isso vai gatear a visão de
// equipes/atletas quando essa jornada existir — aqui é a visão de
// trabalho do próprio admin/assessor).
export interface ResultsPresentationView {
  scheduleEntryId: string;
  teamId: string;
  teamName: string;
  programId: string;
  programName: string;
  categoryId: string;
  categoryName: string;
  categoryFormat: CategoryFormat;
  totalScore: number;
  deductionsTotal: number;
  finalResult: number;
  maxScore: number;
  percentage: number;
}

export interface ResultsCategoryView {
  categoryId: string;
  categoryName: string;
  categoryFormat: CategoryFormat;
  teamCount: number;
  presentations: ResultsPresentationView[];
  topByPercentage: ResultsPresentationView | null;
  topByScore: ResultsPresentationView | null;
  averagePercentage: number;
}

export interface ResultsProgramView {
  programId: string;
  programName: string;
  totalPoints: number;
  presentationCount: number;
}

export interface EventResultsView {
  categories: ResultsCategoryView[];
  presentations: ResultsPresentationView[];
  programs: ResultsProgramView[];
  topOverall: ResultsPresentationView | null;
  topTeamCheer: ResultsPresentationView | null;
  topProgram: ResultsProgramView | null;
  updatedAt: string;
}

@Injectable()
export class ScoringService {
  constructor(
    @InjectRepository(ScoreEvent)
    private readonly scoreEventsRepo: Repository<ScoreEvent>,
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    @InjectRepository(Team)
    private readonly teamsRepo: Repository<Team>,
    private readonly judgesService: JudgesService,
    private readonly judgingService: JudgingService,
    private readonly scheduleService: ScheduleService,
    private readonly eventsService: EventsService,
    private readonly scoringCriteriaService: ScoringCriteriaService,
    private readonly regulationsService: RegulationsService,
    private readonly programsService: ProgramsService,
  ) {}

  // Monta a folha de pontuação de UMA apresentação pro jurado logado —
  // só os grupos/critérios que ele está de fato escalado pra pontuar
  // neste recurso, mais deduções (só se for Jurado de Legalidade) e os
  // eventos já gravados (rehidratação ao abrir/recarregar a tela).
  async getSheet(
    eventId: string,
    userId: string,
    scheduleEntryId: string,
  ): Promise<ScoringSheetView> {
    const participation = await this.assertJudgeParticipation(
      eventId,
      userId,
    );
    const { entry, category, team, resource, allCriteria } =
      await this.loadPresentationContext(eventId, scheduleEntryId);

    const [assignedLeafIds, isLegalityJudge, isHeadJudge] = await Promise.all([
      this.judgingService.getAssignedLeafCriterionIds(
        participation.id,
        entry.resourceId,
      ),
      this.judgingService.isLegalityJudgeForResource(
        participation.id,
        entry.resourceId,
      ),
      this.judgingService.isHeadJudgeForResource(
        participation.id,
        entry.resourceId,
      ),
    ]);

    const groups = this.buildGroups(allCriteria, assignedLeafIds);

    const deductions = isLegalityJudge
      ? (await this.regulationsService.getForEvent(eventId)).deductions
      : [];

    const events = await this.scoreEventsRepo.find({
      where: { scheduleEntryId, judgeParticipationId: participation.id },
      order: { clientCreatedAt: 'ASC' },
    });

    return {
      presentation: {
        id: entry.id,
        teamName: team.name,
        categoryName: category.name,
        resourceId: entry.resourceId,
        resourceName: resource.name,
        presentationTimeSeconds: category.presentationTimeSeconds,
      },
      groups,
      isLegalityJudge,
      isHeadJudge,
      deductions,
      events,
      contestationRequested: !!entry.contestationRequestedAt,
      contestationResolved: !!entry.contestationResolvedAt,
    };
  }

  // Painel Head Judge — Modo Supervisão. Todos os jurados escalados
  // (por critério OU função especial) neste recurso, com status
  // completo/incompleto calculado a partir de `SHEET_SUBMITTED` (clicou
  // "Lançar notas") — não a partir das notas em si. Notas-only (via
  // critérios) deixava jurados só-de-função-especial (ex: legalidade+
  // head judge sem nenhum critério atribuído) presos num terceiro
  // status "não aplicável" mesmo tendo tarefa real a cumprir (rodar o
  // cronômetro, registrar deduções) — `SHEET_SUBMITTED` já cobre
  // uniformemente qualquer tipo de jurado, já que todos passam por
  // "Lançar notas" pra terminar.
  async getHeadJudgeRoster(
    eventId: string,
    userId: string,
    scheduleEntryId: string,
  ): Promise<HeadJudgeRosterView> {
    const { entry, category, team, allCriteria } =
      await this.loadPresentationContext(eventId, scheduleEntryId);
    await this.assertHeadJudgeParticipation(eventId, userId, entry.resourceId);

    const [assignmentsState, specialRoles, allJudges, submittedEvents] =
      await Promise.all([
        this.judgingService.getAssignments(
          eventId,
          category.scoringTemplateId!,
        ),
        this.judgingService.getSpecialRoles(eventId, entry.resourceId),
        this.judgesService.findAllForEvent(eventId),
        this.scoreEventsRepo.find({
          where: {
            scheduleEntryId: entry.id,
            kind: ScoreEventKind.SHEET_SUBMITTED,
          },
        }),
      ]);

    const judgeNameById = new Map(allJudges.map((j) => [j.id, j.name]));

    const leafIdsByJudge = new Map<string, Set<string>>();
    for (const assignment of assignmentsState.criterionAssignments) {
      if (assignment.resourceId !== entry.resourceId) continue;
      for (const judgeId of assignment.judgeIds) {
        const set = leafIdsByJudge.get(judgeId) ?? new Set<string>();
        set.add(assignment.criterionId);
        leafIdsByJudge.set(judgeId, set);
      }
    }

    const specialRolesByJudge = new Map<string, SpecialJudgeRole[]>();
    for (const { role, judgeIds } of specialRoles) {
      for (const judgeId of judgeIds) {
        const list = specialRolesByJudge.get(judgeId) ?? [];
        list.push(role);
        specialRolesByJudge.set(judgeId, list);
      }
    }

    const submittedJudgeIds = new Set(
      submittedEvents.map((e) => e.judgeParticipationId),
    );

    const judgeIds = new Set<string>([
      ...leafIdsByJudge.keys(),
      ...specialRolesByJudge.keys(),
    ]);

    const judges = Array.from(judgeIds).map((judgeParticipationId) => {
      const leafIds = Array.from(leafIdsByJudge.get(judgeParticipationId) ?? []);
      const groups = this.buildGroups(allCriteria, leafIds).map((g) => g.name);
      const status: HeadJudgeRosterEntryStatus = submittedJudgeIds.has(
        judgeParticipationId,
      )
        ? 'complete'
        : 'incomplete';
      return {
        judgeParticipationId,
        name: judgeNameById.get(judgeParticipationId) ?? 'Jurado',
        groups,
        specialRoles: specialRolesByJudge.get(judgeParticipationId) ?? [],
        status,
      };
    });

    judges.sort((a, b) => a.name.localeCompare(b.name));

    return { team: { id: team.id, name: team.name }, judges };
  }

  // Folha de pontuação de OUTRO jurado, vista pelo Head Judge — mesmo
  // formato de getSheet, mas escopada ao `targetJudgeParticipationId`
  // em vez de quem está logado.
  async getSheetForJudge(
    eventId: string,
    userId: string,
    scheduleEntryId: string,
    targetJudgeParticipationId: string,
  ): Promise<HeadJudgeSheetView> {
    const { entry, category, team, resource, allCriteria } =
      await this.loadPresentationContext(eventId, scheduleEntryId);
    await this.assertHeadJudgeParticipation(eventId, userId, entry.resourceId);
    const target = await this.judgesService.findOneForEvent(
      eventId,
      targetJudgeParticipationId,
    );

    const [assignedLeafIds, isLegalityJudge] = await Promise.all([
      this.judgingService.getAssignedLeafCriterionIds(
        target.id,
        entry.resourceId,
      ),
      this.judgingService.isLegalityJudgeForResource(
        target.id,
        entry.resourceId,
      ),
    ]);

    const groups = this.buildGroups(allCriteria, assignedLeafIds);
    const deductions = isLegalityJudge
      ? (await this.regulationsService.getForEvent(eventId)).deductions
      : [];
    // Comentário e rascunho são privados do jurado dono da folha — nem
    // o Head Judge enxerga (só notas/deduções, que ele pode inclusive
    // editar/lançar por cima). Filtrado aqui pra não vazar via `events`
    // (o front reduz esse array pra derivar comment/sketchDataUrl).
    const events = await this.scoreEventsRepo.find({
      where: {
        scheduleEntryId: entry.id,
        judgeParticipationId: target.id,
        kind: Not(In([ScoreEventKind.COMMENT_SET, ScoreEventKind.SKETCH_SET])),
      },
      order: { clientCreatedAt: 'ASC' },
    });

    return {
      presentation: {
        id: entry.id,
        teamName: team.name,
        categoryName: category.name,
        resourceId: entry.resourceId,
        resourceName: resource.name,
        presentationTimeSeconds: category.presentationTimeSeconds,
      },
      groups,
      isLegalityJudge,
      isHeadJudge: false,
      deductions,
      events,
      contestationRequested: !!entry.contestationRequestedAt,
      contestationResolved: !!entry.contestationResolvedAt,
      judge: { id: target.id, name: target.name },
    };
  }

  // Log de alterações de notas/deduções de TODA a equipe atual (todos os
  // jurados desta apresentação) — substitui a "Ocorrências" do print de
  // referência. `actingJudgeName` só vem preenchido quando um Head Judge
  // editou por cima da folha de outro jurado (ver
  // submitEventsAsHeadJudge); comentário/esboço ficam de fora (não são
  // "notas e penalidades").
  async getChangeLog(
    eventId: string,
    userId: string,
    scheduleEntryId: string,
  ): Promise<HeadJudgeLogEntryView[]> {
    const { entry, allCriteria } = await this.loadPresentationContext(
      eventId,
      scheduleEntryId,
    );
    await this.assertHeadJudgeParticipation(eventId, userId, entry.resourceId);

    const [events, allJudges] = await Promise.all([
      this.scoreEventsRepo.find({
        where: {
          scheduleEntryId: entry.id,
          kind: In([
            ScoreEventKind.SCORE_SET,
            ScoreEventKind.DEDUCTION_ADD,
            ScoreEventKind.DEDUCTION_REMOVE,
          ]),
        },
        order: { clientCreatedAt: 'DESC' },
      }),
      this.judgesService.findAllForEvent(eventId),
    ]);

    const judgeNameById = new Map(allJudges.map((j) => [j.id, j.name]));
    const criterionNameById = new Map(allCriteria.map((c) => [c.id, c.name]));

    return events.map((event) => ({
      id: event.id,
      kind: event.kind,
      judgeParticipationId: event.judgeParticipationId,
      judgeName: judgeNameById.get(event.judgeParticipationId) ?? 'Jurado',
      actingJudgeParticipationId: event.enteredByJudgeParticipationId,
      actingJudgeName: event.enteredByJudgeParticipationId
        ? (judgeNameById.get(event.enteredByJudgeParticipationId) ??
          'Head Judge')
        : null,
      criterionId: event.criterionId,
      criterionName: event.criterionId
        ? (criterionNameById.get(event.criterionId) ?? null)
        : null,
      value: event.value,
      deductionType: event.deductionType,
      undoesEventId: event.undoesEventId,
      clientCreatedAt: event.clientCreatedAt,
    }));
  }

  // Visão do admin/assessor na tela de Notas — só apresentações com
  // TODOS os jurados escalados já tendo lançado nota (as incompletas
  // ficam ocultas, não aparecem nem desabilitadas — decisão consciente
  // do usuário). Autorização (ser admin/assessor do evento) já foi
  // feita pelo guard do controller, sem checagem extra aqui.
  async getAdminOverview(eventId: string): Promise<AdminOverviewEntryView[]> {
    const days = await this.scheduleService.getDays(eventId);
    const templateCache = new Map<string, CriterionAssignmentsState>();
    const categoryCache = new Map<string, Category | null>();
    const specialRolesCache = new Map<
      string,
      Awaited<ReturnType<JudgingService['getSpecialRoles']>>
    >();

    const results: AdminOverviewEntryView[] = [];
    for (const day of days) {
      for (const resource of day.resources) {
        for (const entry of resource.entries) {
          if (
            entry.type !== ScheduleEntryType.PRESENTATION ||
            !entry.categoryId ||
            !entry.teamId
          ) {
            continue;
          }

          let category = categoryCache.get(entry.categoryId);
          if (category === undefined) {
            category = await this.categoriesRepo.findOneBy({
              id: entry.categoryId,
            });
            categoryCache.set(entry.categoryId, category);
          }
          if (!category?.scoringTemplateId) continue;

          let assignmentsState = templateCache.get(category.scoringTemplateId);
          if (!assignmentsState) {
            assignmentsState = await this.judgingService.getAssignments(
              eventId,
              category.scoringTemplateId,
            );
            templateCache.set(category.scoringTemplateId, assignmentsState);
          }

          let specialRoles = specialRolesCache.get(entry.resourceId);
          if (!specialRoles) {
            specialRoles = await this.judgingService.getSpecialRoles(
              eventId,
              entry.resourceId,
            );
            specialRolesCache.set(entry.resourceId, specialRoles);
          }

          const complete = await this.isPresentationFullyScored(
            entry.id,
            entry.resourceId,
            assignmentsState,
            specialRoles,
          );
          if (!complete) continue;

          results.push({
            scheduleEntryId: entry.id,
            teamName: entry.teamName ?? 'Equipe',
            categoryName: entry.categoryName ?? '',
            resourceName: resource.name,
            dayDate: day.date,
            contestationRequested: !!entry.contestationRequestedAt,
          });
        }
      }
    }

    return results;
  }

  // Página de Resultados (ver EventResultsView) — mesma completude
  // (isPresentationFullyScored) do overview de Notas, mas aqui calcula
  // nota final + percentual de cada apresentação (finalResult / meta de
  // pontos do template) pra montar os 3 rankings (categoria/equipe/
  // programa) e os 3 destaques do topo da página.
  async getEventResults(eventId: string): Promise<EventResultsView> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const days = await this.scheduleService.getDays(eventId);
    const regulation = await this.regulationsService.getForEvent(eventId);
    const deductionValueByType = new Map(
      regulation.deductions.map((r) => [r.type, r.value]),
    );

    const teams = await this.teamsRepo
      .createQueryBuilder('team')
      .innerJoin('team.program', 'program', 'program.aliasId = :aliasId', {
        aliasId: event.aliasId,
      })
      .getMany();
    const teamsById = new Map(teams.map((t) => [t.id, t]));

    const programs = await this.programsService.findAllForEvent(eventId);
    const programNameById = new Map(programs.map((p) => [p.id, p.name]));

    const templateCache = new Map<string, CriterionAssignmentsState>();
    const categoryCache = new Map<string, Category | null>();
    const specialRolesCache = new Map<
      string,
      Awaited<ReturnType<JudgingService['getSpecialRoles']>>
    >();

    const presentations: ResultsPresentationView[] = [];
    const categoriesInOrder: Category[] = [];

    for (const day of days) {
      for (const resource of day.resources) {
        for (const entry of resource.entries) {
          if (
            entry.type !== ScheduleEntryType.PRESENTATION ||
            !entry.categoryId ||
            !entry.teamId
          ) {
            continue;
          }

          let category = categoryCache.get(entry.categoryId);
          if (category === undefined) {
            category = await this.categoriesRepo.findOne({
              where: { id: entry.categoryId },
              relations: ['scoringTemplate'],
            });
            categoryCache.set(entry.categoryId, category);
            if (category) categoriesInOrder.push(category);
          }
          if (!category?.scoringTemplateId) continue;

          const team = teamsById.get(entry.teamId);
          if (!team) continue;

          let assignmentsState = templateCache.get(category.scoringTemplateId);
          if (!assignmentsState) {
            assignmentsState = await this.judgingService.getAssignments(
              eventId,
              category.scoringTemplateId,
            );
            templateCache.set(category.scoringTemplateId, assignmentsState);
          }

          let specialRoles = specialRolesCache.get(entry.resourceId);
          if (!specialRoles) {
            specialRoles = await this.judgingService.getSpecialRoles(
              eventId,
              entry.resourceId,
            );
            specialRolesCache.set(entry.resourceId, specialRoles);
          }

          const complete = await this.isPresentationFullyScored(
            entry.id,
            entry.resourceId,
            assignmentsState,
            specialRoles,
          );
          if (!complete) continue;

          const scoreEvents = await this.scoreEventsRepo.find({
            where: { scheduleEntryId: entry.id },
          });
          const latestScoreByCriterion = new Map<string, number>();
          const deductionAdds = new Map<string, ScoreEvent>();
          const undoneDeductionIds = new Set<string>();
          for (const event of scoreEvents) {
            if (event.kind === ScoreEventKind.SCORE_SET) {
              if (event.criterionId && event.value !== null) {
                latestScoreByCriterion.set(event.criterionId, event.value);
              }
            } else if (event.kind === ScoreEventKind.DEDUCTION_ADD) {
              deductionAdds.set(event.id, event);
            } else if (event.kind === ScoreEventKind.DEDUCTION_REMOVE) {
              if (event.undoesEventId) undoneDeductionIds.add(event.undoesEventId);
            }
          }
          const totalScore = Array.from(latestScoreByCriterion.values()).reduce(
            (sum, value) => sum + value,
            0,
          );
          const deductionsTotal = Array.from(deductionAdds.values())
            .filter((d) => !undoneDeductionIds.has(d.id))
            .reduce(
              (sum, d) => sum + (deductionValueByType.get(d.deductionType!) ?? 0),
              0,
            );
          const finalResult = totalScore + deductionsTotal;
          const maxScore = category.scoringTemplate?.targetScore ?? 0;
          const percentage = maxScore > 0 ? (finalResult / maxScore) * 100 : 0;

          presentations.push({
            scheduleEntryId: entry.id,
            teamId: team.id,
            teamName: team.name,
            programId: team.programId,
            programName: programNameById.get(team.programId) ?? 'Programa',
            categoryId: category.id,
            categoryName: category.name,
            categoryFormat: category.categoryFormat,
            totalScore,
            deductionsTotal,
            finalResult,
            maxScore,
            percentage,
          });
        }
      }
    }

    const presentationsByCategory = new Map<string, ResultsPresentationView[]>();
    for (const p of presentations) {
      const list = presentationsByCategory.get(p.categoryId) ?? [];
      list.push(p);
      presentationsByCategory.set(p.categoryId, list);
    }

    const categories: ResultsCategoryView[] = categoriesInOrder
      .filter((c) => presentationsByCategory.has(c.id))
      .map((c) => {
        const list = presentationsByCategory.get(c.id)!;
        const byPercentage = [...list].sort((a, b) => b.percentage - a.percentage);
        const byScore = [...list].sort((a, b) => b.finalResult - a.finalResult);
        const averagePercentage =
          list.reduce((sum, p) => sum + p.percentage, 0) / list.length;
        return {
          categoryId: c.id,
          categoryName: c.name,
          categoryFormat: c.categoryFormat,
          teamCount: list.length,
          presentations: byPercentage,
          topByPercentage: byPercentage[0] ?? null,
          topByScore: byScore[0] ?? null,
          averagePercentage,
        };
      });

    const byPercentageOverall = [...presentations].sort(
      (a, b) => b.percentage - a.percentage,
    );

    const programTotals = new Map<string, ResultsProgramView>();
    for (const p of presentations) {
      const current = programTotals.get(p.programId) ?? {
        programId: p.programId,
        programName: p.programName,
        totalPoints: 0,
        presentationCount: 0,
      };
      current.totalPoints += p.finalResult;
      current.presentationCount += 1;
      programTotals.set(p.programId, current);
    }
    const byProgram = Array.from(programTotals.values()).sort(
      (a, b) => b.totalPoints - a.totalPoints,
    );

    return {
      categories,
      presentations: byPercentageOverall,
      programs: byProgram,
      topOverall: byPercentageOverall[0] ?? null,
      topTeamCheer:
        byPercentageOverall.find(
          (p) => p.categoryFormat === CategoryFormat.TEAM_CHEER,
        ) ?? null,
      topProgram: byProgram[0] ?? null,
      updatedAt: new Date().toISOString(),
    };
  }

  // Liberação global do evento (ver ReleaseFlagsView) — usado pelo
  // painel do admin/assessor pra saber o estado atual dos 3 switches.
  async getReleaseFlags(eventId: string): Promise<ReleaseFlagsView> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    return {
      scoresReleased: !!event.scoresReleasedAt,
      contestationReleased: !!event.contestationReleasedAt,
      resultsReleased: !!event.resultsReleasedAt,
    };
  }

  // Toggles do admin — liberar notas/contestação/resultado, ação
  // global do evento (ver EventsService.setReleaseFlags pela cascata).
  async setReleaseFlags(
    eventId: string,
    changes: {
      scoresReleased?: boolean;
      contestationReleased?: boolean;
      resultsReleased?: boolean;
    },
  ): Promise<ReleaseFlagsView> {
    const event = await this.eventsService.setReleaseFlags(eventId, changes);
    return {
      scoresReleased: !!event.scoresReleasedAt,
      contestationReleased: !!event.contestationReleasedAt,
      resultsReleased: !!event.resultsReleasedAt,
    };
  }

  // Visão do Programa (dono da equipe) na tela de notas — só as
  // apresentações das PRÓPRIAS equipes, quando as notas já foram
  // liberadas globalmente pro evento (`Event.scoresReleasedAt`).
  // Continua exigindo completude (mesmo critério do overview do
  // admin) — mesmo com o switch ligado, não faz sentido mostrar uma
  // apresentação que nenhum jurado terminou de pontuar ainda.
  async getTeamOverview(
    eventId: string,
    userId: string,
  ): Promise<AdminOverviewEntryView[]> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    if (!event.scoresReleasedAt) return [];

    const participation = await this.assertProgramParticipation(
      eventId,
      userId,
    );
    const myTeams = await this.teamsRepo.find({
      where: { programId: participation.id },
    });
    const myTeamIds = new Set(myTeams.map((t) => t.id));

    const days = await this.scheduleService.getDays(eventId);
    const templateCache = new Map<string, CriterionAssignmentsState>();
    const categoryCache = new Map<string, Category | null>();
    const specialRolesCache = new Map<
      string,
      Awaited<ReturnType<JudgingService['getSpecialRoles']>>
    >();

    const results: AdminOverviewEntryView[] = [];
    for (const day of days) {
      for (const resource of day.resources) {
        for (const entry of resource.entries) {
          if (
            entry.type !== ScheduleEntryType.PRESENTATION ||
            !entry.teamId ||
            !myTeamIds.has(entry.teamId) ||
            !entry.categoryId
          ) {
            continue;
          }

          let category = categoryCache.get(entry.categoryId);
          if (category === undefined) {
            category = await this.categoriesRepo.findOneBy({
              id: entry.categoryId,
            });
            categoryCache.set(entry.categoryId, category);
          }
          if (!category?.scoringTemplateId) continue;

          let assignmentsState = templateCache.get(category.scoringTemplateId);
          if (!assignmentsState) {
            assignmentsState = await this.judgingService.getAssignments(
              eventId,
              category.scoringTemplateId,
            );
            templateCache.set(category.scoringTemplateId, assignmentsState);
          }

          let specialRoles = specialRolesCache.get(entry.resourceId);
          if (!specialRoles) {
            specialRoles = await this.judgingService.getSpecialRoles(
              eventId,
              entry.resourceId,
            );
            specialRolesCache.set(entry.resourceId, specialRoles);
          }

          const complete = await this.isPresentationFullyScored(
            entry.id,
            entry.resourceId,
            assignmentsState,
            specialRoles,
          );
          if (!complete) continue;

          results.push({
            scheduleEntryId: entry.id,
            teamName: entry.teamName ?? 'Equipe',
            categoryName: entry.categoryName ?? '',
            resourceName: resource.name,
            dayDate: day.date,
            contestationRequested: !!entry.contestationRequestedAt,
          });
        }
      }
    }
    return results;
  }

  // Detalhe somente-leitura pro admin/assessor — sem restrição de
  // dono (eles podem ver qualquer apresentação do evento).
  async getAdminPresentationDetail(
    eventId: string,
    scheduleEntryId: string,
  ): Promise<PresentationDetailView> {
    return this.buildPresentationDetail(eventId, scheduleEntryId);
  }

  // Mesmo detalhe, mas só se a apresentação for de uma equipe do
  // Programa chamador E as notas já estiverem liberadas globalmente.
  async getTeamPresentationDetail(
    eventId: string,
    scheduleEntryId: string,
    userId: string,
  ): Promise<PresentationDetailView> {
    const entry = await this.scheduleService.findEntryInEventOrThrow(
      eventId,
      scheduleEntryId,
    );
    if (!entry.teamId) {
      throw new BadRequestException('Apresentação sem equipe definida.');
    }
    await this.assertProgramOwnsTeam(eventId, userId, entry.teamId);
    const event = await this.eventsService.findEventOrThrow(eventId);
    if (!event.scoresReleasedAt) {
      throw new ForbiddenException(
        'As notas deste evento ainda não foram liberadas.',
      );
    }
    return this.buildPresentationDetail(eventId, scheduleEntryId);
  }

  // Equipe solicita contestação — só se a apresentação for dela E a
  // contestação estiver liberada globalmente pro evento. Idempotente
  // (ver ScheduleService.setContestationRequested — isso continua por
  // apresentação, é o PEDIDO de contestação de uma rotina específica,
  // não a liberação em si).
  async requestContestation(
    eventId: string,
    scheduleEntryId: string,
    userId: string,
  ): Promise<void> {
    const entry = await this.scheduleService.findEntryInEventOrThrow(
      eventId,
      scheduleEntryId,
    );
    if (!entry.teamId) {
      throw new BadRequestException('Apresentação sem equipe definida.');
    }
    await this.assertProgramOwnsTeam(eventId, userId, entry.teamId);
    // Cada apresentação só pode ser contestada uma única vez — mesmo
    // depois de resolvida, `contestationRequestedAt` nunca é limpo, então
    // essa checagem também cobre "já foi resolvida, não dá pra contestar
    // de novo" sem precisar olhar `contestationResolvedAt` à parte.
    if (entry.contestationRequestedAt) {
      throw new ConflictException('Esta apresentação já foi contestada.');
    }
    const event = await this.eventsService.findEventOrThrow(eventId);
    if (!event.contestationReleasedAt) {
      throw new ForbiddenException(
        'A contestação não está liberada para este evento.',
      );
    }
    await this.scheduleService.setContestationRequested(
      eventId,
      scheduleEntryId,
    );
  }

  // Jurado marca a contestação de uma apresentação como resolvida —
  // aparece na própria súmula (mesma tela que mostra "a equipe
  // solicitou contestação"). Não exige ser o jurado ESCALADO nesta
  // pista especificamente (mesmo raciocínio permissivo de getSheet,
  // que também não bloqueia um jurado sem critério atribuído) — só
  // precisa ser jurado do evento.
  async resolveContestation(
    eventId: string,
    userId: string,
    scheduleEntryId: string,
  ): Promise<void> {
    await this.assertJudgeParticipation(eventId, userId);
    const entry = await this.scheduleService.findEntryInEventOrThrow(
      eventId,
      scheduleEntryId,
    );
    if (!entry.contestationRequestedAt) {
      throw new BadRequestException(
        'Esta apresentação não tem contestação solicitada.',
      );
    }
    await this.scheduleService.setContestationResolved(
      eventId,
      scheduleEntryId,
    );
  }

  // Quais apresentações (scheduleEntryId) este jurado já marcou como
  // enviadas (clicou "Lançar notas" — ver EventLiveScoringPage.
  // handleSubmit) — alimenta a lista "todas as apresentações, na
  // sequência do cronograma" da tela de Notas (badge "Concluída").
  async getMySubmittedEntryIds(
    eventId: string,
    userId: string,
  ): Promise<string[]> {
    const participation = await this.assertJudgeParticipation(
      eventId,
      userId,
    );
    const rows = await this.scoreEventsRepo.find({
      where: {
        judgeParticipationId: participation.id,
        kind: ScoreEventKind.SHEET_SUBMITTED,
      },
    });
    return Array.from(new Set(rows.map((r) => r.scheduleEntryId)));
  }

  // Recebe a fila (offline ou não) do buffer local do navegador —
  // idempotente por design (`id` vem do cliente): reenviar o mesmo
  // evento depois de uma falha de rede não duplica nada.
  async submitEvents(
    eventId: string,
    userId: string,
    events: ScoreEventInputDto[],
  ): Promise<{ savedIds: string[] }> {
    const participation = await this.assertJudgeParticipation(
      eventId,
      userId,
    );
    const rows = await this.buildScoreEventRows(
      eventId,
      participation.id,
      events,
    );

    if (rows.length > 0) {
      await this.scoreEventsRepo
        .createQueryBuilder()
        .insert()
        .into(ScoreEvent)
        .values(rows)
        .orIgnore() // ON CONFLICT (id) DO NOTHING — reenvio idempotente
        .execute();
    }

    return { savedIds: rows.map((r) => r.id) };
  }

  // Painel Head Judge — o Head Judge edita a folha de OUTRO jurado. As
  // linhas gravadas continuam pertencendo ao jurado-alvo
  // (`judgeParticipationId`), só marcam quem de fato editou
  // (`enteredByJudgeParticipationId`) pra aparecer no log de alterações.
  async submitEventsAsHeadJudge(
    eventId: string,
    userId: string,
    scheduleEntryId: string,
    targetJudgeParticipationId: string,
    events: ScoreEventInputDto[],
  ): Promise<{ savedIds: string[] }> {
    if (events.length === 0) return { savedIds: [] };

    const { entry } = await this.loadPresentationContext(
      eventId,
      scheduleEntryId,
    );
    const caller = await this.assertHeadJudgeParticipation(
      eventId,
      userId,
      entry.resourceId,
    );
    const target = await this.judgesService.findJudgeOrThrow(
      eventId,
      targetJudgeParticipationId,
    );

    const rows = await this.buildScoreEventRows(
      eventId,
      target.id,
      events,
      caller.id,
    );

    if (rows.length > 0) {
      await this.scoreEventsRepo
        .createQueryBuilder()
        .insert()
        .into(ScoreEvent)
        .values(rows)
        .orIgnore()
        .execute();
    }

    return { savedIds: rows.map((r) => r.id) };
  }

  // Valida cada evento do lote contra as atribuições do DONO da nota
  // (`ownerParticipationId` — quem é jurado daquele critério/legalidade,
  // não necessariamente quem está fazendo a chamada) e monta as linhas
  // prontas pra inserir. Reusado tanto pelo fluxo normal (jurado
  // pontuando a própria folha, `actingParticipationId` ausente) quanto
  // pelo Head Judge editando a folha de outro jurado (`ownerParticipationId`
  // = o alvo, `actingParticipationId` = o próprio Head Judge).
  private async buildScoreEventRows(
    eventId: string,
    ownerParticipationId: string,
    events: ScoreEventInputDto[],
    actingParticipationId?: string,
  ): Promise<ScoreEvent[]> {
    // Cache por scheduleEntryId+resourceId pra não revalidar o mesmo
    // recurso/critérios-atribuídos a cada evento do lote.
    const resourceCache = new Map<string, string>(); // scheduleEntryId -> resourceId
    const assignedLeafCache = new Map<string, Set<string>>(); // resourceId -> leafIds
    const legalityCache = new Map<string, boolean>(); // resourceId -> isLegalityJudge

    const rows: ScoreEvent[] = [];
    for (const input of events) {
      let resourceId = resourceCache.get(input.scheduleEntryId);
      if (!resourceId) {
        const entry = await this.scheduleService.findEntryInEventOrThrow(
          eventId,
          input.scheduleEntryId,
        );
        resourceId = entry.resourceId;
        resourceCache.set(input.scheduleEntryId, resourceId);
      }

      if (input.kind === ScoreEventKind.SCORE_SET) {
        if (!input.criterionId || input.value === undefined) {
          throw new BadRequestException(
            'Evento de nota precisa de criterionId e value.',
          );
        }
        let leafIds = assignedLeafCache.get(resourceId);
        if (!leafIds) {
          leafIds = new Set(
            await this.judgingService.getAssignedLeafCriterionIds(
              ownerParticipationId,
              resourceId,
            ),
          );
          assignedLeafCache.set(resourceId, leafIds);
        }
        if (!leafIds.has(input.criterionId)) {
          throw new ForbiddenException(
            'Este jurado não está escalado pra pontuar este critério.',
          );
        }
      } else if (
        input.kind === ScoreEventKind.DEDUCTION_ADD ||
        input.kind === ScoreEventKind.DEDUCTION_REMOVE ||
        input.kind === ScoreEventKind.TIMER_STOPPED ||
        input.kind === ScoreEventKind.DEDUCTION_CODE_SET
      ) {
        let isLegality = legalityCache.get(resourceId);
        if (isLegality === undefined) {
          isLegality = await this.judgingService.isLegalityJudgeForResource(
            ownerParticipationId,
            resourceId,
          );
          legalityCache.set(resourceId, isLegality);
        }
        if (!isLegality) {
          throw new ForbiddenException(
            'Só o Jurado de Legalidade pode registrar deduções/cronômetro.',
          );
        }
        if (input.kind === ScoreEventKind.DEDUCTION_ADD && !input.deductionType) {
          throw new BadRequestException(
            'Evento de dedução precisa de deductionType.',
          );
        }
        if (input.kind === ScoreEventKind.DEDUCTION_REMOVE && !input.undoesEventId) {
          throw new BadRequestException(
            'Evento de desfazer dedução precisa de undoesEventId.',
          );
        }
        if (
          input.kind === ScoreEventKind.TIMER_STOPPED &&
          input.presentationElapsedMs === undefined
        ) {
          throw new BadRequestException(
            'Evento de cronômetro parado precisa de presentationElapsedMs.',
          );
        }
        if (
          input.kind === ScoreEventKind.DEDUCTION_CODE_SET &&
          (!input.undoesEventId || input.text === undefined)
        ) {
          throw new BadRequestException(
            'Evento de código de ilegalidade precisa de undoesEventId e text.',
          );
        }
      }

      rows.push(
        this.scoreEventsRepo.create({
          id: input.id,
          scheduleEntryId: input.scheduleEntryId,
          judgeParticipationId: ownerParticipationId,
          enteredByJudgeParticipationId:
            actingParticipationId && actingParticipationId !== ownerParticipationId
              ? actingParticipationId
              : null,
          kind: input.kind,
          criterionId: input.criterionId ?? null,
          value: input.value ?? null,
          deductionType: input.deductionType ?? null,
          undoesEventId: input.undoesEventId ?? null,
          presentationElapsedMs: input.presentationElapsedMs ?? null,
          text: input.text ?? null,
          clientCreatedAt: new Date(input.clientCreatedAt),
        }),
      );
    }

    return rows;
  }

  // Uma apresentação é "completa" quando todo `judgeParticipationId`
  // escalado neste recurso — por critério OU por função especial
  // (legalidade/head judge) — já clicou "Lançar notas"
  // (`SHEET_SUBMITTED`). Antes disso checava só completude de
  // critério, o que deixava uma apresentação julgada só por
  // legalidade/head-judge (zero critérios atribuídos) nunca "completa"
  // — mesmo bug corrigido em `getHeadJudgeRoster`, ver ali.
  private async isPresentationFullyScored(
    scheduleEntryId: string,
    resourceId: string,
    assignmentsState: CriterionAssignmentsState,
    specialRoles: Awaited<ReturnType<JudgingService['getSpecialRoles']>>,
  ): Promise<boolean> {
    const judgeIds = new Set<string>();
    for (const assignment of assignmentsState.criterionAssignments) {
      if (assignment.resourceId !== resourceId) continue;
      for (const judgeId of assignment.judgeIds) judgeIds.add(judgeId);
    }
    for (const { judgeIds: roleJudgeIds } of specialRoles) {
      for (const judgeId of roleJudgeIds) judgeIds.add(judgeId);
    }
    if (judgeIds.size === 0) return false;

    const submittedEvents = await this.scoreEventsRepo.find({
      where: { scheduleEntryId, kind: ScoreEventKind.SHEET_SUBMITTED },
    });
    const submittedJudgeIds = new Set(
      submittedEvents.map((e) => e.judgeParticipationId),
    );

    for (const judgeId of judgeIds) {
      if (!submittedJudgeIds.has(judgeId)) return false;
    }
    return true;
  }

  // Monta a visão combinada de UMA apresentação — todos os grupos do
  // sistema de pontuação + legalidade JUNTOS, cada critério marcado
  // com o nome do jurado responsável, mais o comentário/esboço de
  // cada jurado que deixou algo. Reusado por `getAdminPresentationDetail`
  // (sem restrição) e `getTeamPresentationDetail` (já validado antes
  // de chamar). Simplificação consciente: se um critério-folha tiver
  // MAIS de um jurado atribuído (o modelo permite, mas na prática é
  // sempre um só), só o primeiro é usado pra resolver o valor/nome —
  // caso de dois jurados no mesmo critério não é um cenário real hoje.
  private async buildPresentationDetail(
    eventId: string,
    scheduleEntryId: string,
  ): Promise<PresentationDetailView> {
    const { entry, category, team, resource, allCriteria } =
      await this.loadPresentationContext(eventId, scheduleEntryId);

    const [event, assignmentsState, specialRoles, allJudges, events, regulation] =
      await Promise.all([
        this.eventsService.findEventOrThrow(eventId),
        this.judgingService.getAssignments(
          eventId,
          category.scoringTemplateId!,
        ),
        this.judgingService.getSpecialRoles(eventId, entry.resourceId),
        this.judgesService.findAllForEvent(eventId),
        this.scoreEventsRepo.find({
          where: { scheduleEntryId: entry.id },
          order: { clientCreatedAt: 'ASC' },
        }),
        this.regulationsService.getForEvent(eventId),
      ]);

    const judgeNameById = new Map(allJudges.map((j) => [j.id, j.name]));

    const judgeIdByLeaf = new Map<string, string>();
    for (const assignment of assignmentsState.criterionAssignments) {
      if (assignment.resourceId !== entry.resourceId) continue;
      if (assignment.judgeIds.length === 0) continue;
      judgeIdByLeaf.set(assignment.criterionId, assignment.judgeIds[0]);
    }

    const latestScoreByCriterion = new Map<string, number>();
    const deductionAdds = new Map<string, ScoreEvent>();
    const undoneDeductionIds = new Set<string>();
    const lastCommentByJudge = new Map<string, string>();

    for (const event of events) {
      switch (event.kind) {
        case ScoreEventKind.SCORE_SET:
          if (event.criterionId && event.value !== null) {
            latestScoreByCriterion.set(event.criterionId, event.value);
          }
          break;
        case ScoreEventKind.DEDUCTION_ADD:
          deductionAdds.set(event.id, event);
          break;
        case ScoreEventKind.DEDUCTION_REMOVE:
          if (event.undoesEventId) undoneDeductionIds.add(event.undoesEventId);
          break;
        case ScoreEventKind.COMMENT_SET:
          if (event.text !== null) {
            lastCommentByJudge.set(event.judgeParticipationId, event.text);
          }
          break;
      }
    }

    const byId = new Map(allCriteria.map((c) => [c.id, c]));
    const groups = new Map<string, PresentationDetailGroupView>();
    for (const criterion of allCriteria) {
      if (criterion.type !== ScoringCriterionType.SCORE_ITEM) continue;
      const judgeId = judgeIdByLeaf.get(criterion.id);
      if (!judgeId) continue;

      let root = criterion;
      while (root.parentId) {
        const parent = byId.get(root.parentId);
        if (!parent) break;
        root = parent;
      }

      let group = groups.get(root.id);
      if (!group) {
        group = { id: root.id, name: root.name, criteria: [] };
        groups.set(root.id, group);
      }
      group.criteria.push({
        id: criterion.id,
        name: criterion.name,
        description: criterion.description,
        maxScore: criterion.maxScore,
        allowDecimalScoring: criterion.allowDecimalScoring,
        order: criterion.order,
        value: latestScoreByCriterion.get(criterion.id) ?? null,
        judgeName: judgeNameById.get(judgeId) ?? 'Jurado',
      });
    }
    for (const group of groups.values()) {
      group.criteria.sort((a, b) => a.order - b.order);
    }

    const deductionValueByType = new Map(
      regulation.deductions.map((r) => [r.type, r.value]),
    );

    const legalityRole = specialRoles.find(
      (r) => r.role === SpecialJudgeRole.LEGALITY_JUDGE,
    );
    const legalityJudgeId = legalityRole?.judgeIds[0];
    const legality: PresentationDetailLegalityView | null = legalityJudgeId
      ? {
          judgeName: judgeNameById.get(legalityJudgeId) ?? 'Jurado',
          deductions: Array.from(deductionAdds.values())
            .filter((d) => !undoneDeductionIds.has(d.id))
            .map((d) => ({
              type: d.deductionType!,
              value: deductionValueByType.get(d.deductionType!) ?? 0,
              presentationElapsedMs: d.presentationElapsedMs,
              clientCreatedAt: d.clientCreatedAt,
            })),
        }
      : null;

    // Rascunho (SKETCH_SET) fica de fora de propósito — é visível só
    // pro próprio jurado, admin/assessor/programa não devem enxergá-lo.
    const notes: PresentationDetailNoteView[] = Array.from(
      lastCommentByJudge.entries(),
    )
      .map(([judgeId, comment]) => ({
        judgeName: judgeNameById.get(judgeId) ?? 'Jurado',
        comment,
      }))
      .filter((n) => n.comment);

    return {
      presentation: {
        id: entry.id,
        teamName: team.name,
        categoryName: category.name,
        resourceName: resource.name,
      },
      groups: Array.from(groups.values()),
      legality,
      notes,
      scoresReleased: !!event.scoresReleasedAt,
      contestationReleased: !!event.contestationReleasedAt,
      contestationRequested: !!entry.contestationRequestedAt,
    };
  }

  // Resolve a ProgramParticipation do chamador neste evento — Forbidden
  // se ele não for um Programa vinculado aqui.
  private async assertProgramParticipation(eventId: string, userId: string) {
    const participation = await this.programsService.findParticipationByUserId(
      eventId,
      userId,
    );
    if (!participation) {
      throw new ForbiddenException('Você não é um programa neste evento.');
    }
    return participation;
  }

  // Confere que `teamId` pertence a uma equipe do Programa chamador.
  private async assertProgramOwnsTeam(
    eventId: string,
    userId: string,
    teamId: string,
  ): Promise<void> {
    const participation = await this.assertProgramParticipation(
      eventId,
      userId,
    );
    const team = await this.teamsRepo.findOneBy({
      id: teamId,
      programId: participation.id,
    });
    if (!team) {
      throw new ForbiddenException(
        'Esta apresentação não pertence ao seu programa.',
      );
    }
  }

  private async assertJudgeParticipation(eventId: string, userId: string) {
    const participation = await this.judgesService.findParticipationByUserId(
      eventId,
      userId,
    );
    if (!participation) {
      throw new ForbiddenException('Você não é jurado neste evento.');
    }
    return participation;
  }

  // Painel Head Judge — confere que quem está logado é jurado do evento
  // E Head Judge deste recurso especificamente (mesmo padrão de
  // isLegalityJudgeForResource: função por recurso, não pelo evento
  // inteiro).
  private async assertHeadJudgeParticipation(
    eventId: string,
    userId: string,
    resourceId: string,
  ) {
    const participation = await this.assertJudgeParticipation(
      eventId,
      userId,
    );
    const isHeadJudge = await this.judgingService.isHeadJudgeForResource(
      participation.id,
      resourceId,
    );
    if (!isHeadJudge) {
      throw new ForbiddenException('Você não é Head Judge deste recurso.');
    }
    return participation;
  }

  // Carrega e valida entry/categoria/equipe/recurso/critérios de UMA
  // apresentação — extraído de getSheet pra ser reusado também pelo
  // Painel Head Judge (roster, folha de outro jurado, log), que precisa
  // exatamente do mesmo contexto antes de aplicar sua própria checagem
  // de autorização (assertHeadJudgeParticipation).
  private async loadPresentationContext(
    eventId: string,
    scheduleEntryId: string,
  ) {
    const entry = await this.scheduleService.findEntryInEventOrThrow(
      eventId,
      scheduleEntryId,
    );
    if (entry.type !== ScheduleEntryType.PRESENTATION) {
      throw new BadRequestException(
        'Este item do cronograma não é uma apresentação.',
      );
    }
    if (!entry.categoryId || !entry.teamId) {
      throw new BadRequestException(
        'Apresentação sem equipe/categoria definida.',
      );
    }

    const [category, team, resource] = await Promise.all([
      this.categoriesRepo.findOneBy({ id: entry.categoryId }),
      this.teamsRepo.findOneBy({ id: entry.teamId }),
      this.scheduleService.findResourceInEventOrThrow(
        eventId,
        entry.resourceId,
      ),
    ]);
    if (!category || !team) {
      throw new BadRequestException(
        'Equipe/categoria da apresentação não encontrada.',
      );
    }
    if (!category.scoringTemplateId) {
      throw new BadRequestException(
        'Esta categoria não tem sistema de pontuação definido.',
      );
    }

    const allCriteria = await this.scoringCriteriaService.findAllForTemplateUnchecked(
      category.scoringTemplateId,
    );

    return { entry, category, team, resource, allCriteria };
  }

  // Só os grupos-RAIZ que têm ao menos uma folha atribuída a este
  // jurado, cada um com as folhas atribuídas (não as não-atribuídas —
  // a tela de notas só mostra o que é dele). Ignora nesting
  // intermediário (grupo dentro de grupo) de propósito — a tela de
  // notas mostra 2 níveis (grupo-raiz -> item), igual à referência.
  private buildGroups(
    allCriteria: ScoringCriterion[],
    assignedLeafIds: string[],
  ): ScoringGroupView[] {
    const byId = new Map(allCriteria.map((c) => [c.id, c]));
    const groups = new Map<string, ScoringGroupView>();

    for (const leafId of assignedLeafIds) {
      const leaf = byId.get(leafId);
      if (!leaf || leaf.type !== ScoringCriterionType.SCORE_ITEM) continue;

      let root = leaf;
      while (root.parentId) {
        const parent = byId.get(root.parentId);
        if (!parent) break;
        root = parent;
      }

      let group = groups.get(root.id);
      if (!group) {
        group = { id: root.id, name: root.name, criteria: [] };
        groups.set(root.id, group);
      }
      group.criteria.push({
        id: leaf.id,
        name: leaf.name,
        description: leaf.description,
        maxScore: leaf.maxScore,
        allowDecimalScoring: leaf.allowDecimalScoring,
        order: leaf.order,
      });
    }

    for (const group of groups.values()) {
      group.criteria.sort((a, b) => a.order - b.order);
    }

    return Array.from(groups.values());
  }
}

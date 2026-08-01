import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { ScoreEvent } from '../entities/score-event.entity';
import { ScheduleEntry } from '../../schedule/entities/schedule-entry.entity';
import { ScoreEventKind } from '../enums/score-event-kind.enum';
import { ScoreEventInputDto } from '../dto/score-event-input.dto';
import { WithdrawPresentationDto } from '../dto/withdraw-presentation.dto';
import { Category } from '../../categories/entities/category.entity';
import { CategoryFormat } from '../../categories/enums/category-format.enum';
import { Team } from '../../teams/entities/team.entity';
import {
  ScoreBand,
  ScoringCriterion,
} from '../../scoring-templates/entities/scoring-criterion.entity';
import { ScoringCriterionType } from '../../scoring-templates/enums/scoring-criterion-type.enum';
import { ScheduleEntryType } from '../../schedule/enums/schedule-entry-type.enum';
import { JudgesService } from '../../judges/services/judges.service';
import { JudgingService } from '../../judging/services/judging.service';
import type { CriterionAssignmentsState } from '../../judging/services/judging.service';
import { SpecialJudgeRole } from '../../judging/enums/special-judge-role.enum';
import { ScheduleService } from '../../schedule/services/schedule.service';
import { EventsService } from '../../events/services/events.service';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import { EventStatus } from '../../events/enums/event-status.enum';
import { ProgramsService } from '../../programs/services/programs.service';
import { AthletesService } from '../../athletes/services/athletes.service';
import { ScoringCriteriaService } from '../../scoring-templates/services/scoring-criteria.service';
import { DeductionType } from '../../regulations/enums/deduction-type.enum';
import {
  RegulationsService,
  type DeductionRuleView,
} from '../../regulations/services/regulations.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/enums/notification-type.enum';
import { NotificationAudience } from '../../notifications/enums/notification-audience.enum';

export interface ScoringCriterionView {
  id: string;
  name: string;
  description: string | null;
  maxScore: number;
  allowDecimalScoring: boolean;
  order: number;
  // Faixas de pontuação (efeito visual na tela do jurado — ver
  // ScoringCriteriaGroups.tsx) — só têm sentido pra `type: SCORE_ITEM`,
  // que é a única coisa que chega aqui (buildGroups só monta folhas).
  useScoreBands: boolean;
  scoreBands: ScoreBand[] | null;
  // Descrição dos subgrupos intermediários no caminho até o grupo-raiz
  // (ex: "Stunt"/"Pyramids" dentro de "Building"), do mais próximo do
  // item até o mais próximo da raiz — buildGroups achata a hierarquia
  // em 2 níveis (grupo-raiz -> item) de propósito, então esses
  // subgrupos nunca viram uma seção própria; isso só recupera a
  // descrição deles (quando existe) pra exibir junto do item. A
  // descrição do próprio grupo-raiz continua em ScoringGroupView.description,
  // não repetida aqui.
  subgroupDescriptions: { name: string; description: string }[];
  // Maior nota atribuída a este critério entre todas as apresentações
  // da MESMA categoria (comparação só faz sentido dentro da mesma
  // categoria — mesmo sistema de pontuação, mesma faixa de comparação
  // justa), com todas as equipes empatadas nesse valor (normalmente 1,
  // mais de 1 só em empate real) — ver
  // ScoringService.getCriterionComparisons. `null` quando nenhuma
  // apresentação da categoria ainda tem nota nesse item. Usado só pelo
  // texto compacto do mobile (ver ScoringCriteriaGroups.tsx); o slider
  // do desktop usa `teamScores` abaixo.
  bestScore: { value: number; teamNames: string[] } | null;
  // Nota de cada OUTRA equipe da mesma categoria neste critério (exclui
  // a equipe da própria apresentação sendo pontuada — ela já é
  // representada pelo polegar do slider) — um marcador por equipe no
  // slider do desktop, mesmo estilo pra todas, sem destaque de "líder"
  // (ver ScoreBandSlider.tsx). Lista vazia quando não há nenhuma outra
  // equipe com nota neste item ainda.
  teamScores: { value: number; teamName: string }[];
}

export interface ScoringGroupView {
  id: string;
  name: string;
  description: string | null;
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
  // Diferente de PresentationDetailView/ScoringSheetView (que também
  // têm esse campo) — aqui é o que dá pra badge da LISTA trocar de
  // "Contestação" pra "Contestação resolvida" sem precisar abrir o
  // detalhe (2026-08-01, pedido do usuário).
  contestationResolved: boolean;
  // Nota final e percentual (ver computePresentationResult) — mostrados
  // direto na lista de Notas (admin/assessor e Programa) pra não
  // precisar abrir o detalhe por critério só pra ver o resultado.
  finalResult: number;
  percentage: number;
  // Presença nesta lista já é uma exceção (ver buildTeamScopedOverview/
  // getAdminOverview — normalmente só entra apresentação 100%
  // pontuada); desistida entra mesmo incompleta, sempre com esse campo
  // true e finalResult/percentage zerados (nunca foi avaliada de
  // verdade).
  withdrawn: boolean;
}

// Liberação global do evento — "Liberar notas"/"Liberar contestação"/
// "Liberar resultado", um switch só por evento (ver
// EventsService.setReleaseFlags pela cascata entre os dois primeiros).
export interface ReleaseFlagsView {
  scoresReleased: boolean;
  contestationReleased: boolean;
  resultsReleased: boolean;
}

// `value` já é a MÉDIA quando mais de um jurado pontua o mesmo
// critério (ver computeAverageScoreByCriterion) — por decisão do
// usuário, esta view não expõe jurado por jurado, só o valor final.
export interface PresentationDetailCriterionView extends ScoringCriterionView {
  value: number | null;
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

// Resposta da página de Resultados pública (ver ResultsController) —
// admin/assessor/jurado sempre veem (`released: true`); programa/
// espectador (e, futuramente, atleta) só depois que o admin acionar
// `Event.resultsReleasedAt` (ver ReleaseFlagsPanel na tela de Notas).
// Antes disso `results` vem `null` e o front mostra um aviso de "em
// breve".
export interface EventResultsResponse {
  released: boolean;
  results: EventResultsView | null;
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
    @InjectRepository(ScheduleEntry)
    private readonly scheduleEntriesRepo: Repository<ScheduleEntry>,
    private readonly judgesService: JudgesService,
    private readonly judgingService: JudgingService,
    private readonly scheduleService: ScheduleService,
    private readonly eventsService: EventsService,
    private readonly scoringCriteriaService: ScoringCriteriaService,
    private readonly regulationsService: RegulationsService,
    private readonly programsService: ProgramsService,
    private readonly athletesService: AthletesService,
    private readonly notificationsService: NotificationsService,
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
    const participation = await this.assertJudgeParticipation(eventId, userId);
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

    const criterionComparisons = await this.getCriterionComparisons(
      category.id,
      assignedLeafIds,
      team.id,
    );
    for (const group of groups) {
      for (const criterion of group.criteria) {
        const comparison = criterionComparisons.get(criterion.id);
        criterion.bestScore = comparison?.bestScore ?? null;
        criterion.teamScores = comparison?.teamScores ?? [];
      }
    }

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
      const leafIds = Array.from(
        leafIdsByJudge.get(judgeParticipationId) ?? [],
      );
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
    const regulation = await this.regulationsService.getForEvent(eventId);
    const deductionValueByType = new Map(
      regulation.deductions.map((r) => [r.type, r.value]),
    );
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
            category = await this.categoriesRepo.findOne({
              where: { id: entry.categoryId },
              relations: ['scoringTemplate'],
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
          // Desistida é a única exceção ao "só entra se 100%
          // pontuada" — nunca vai ficar completa (ninguém pode mais
          // lançar nota pra ela), mas precisa aparecer marcada nas
          // súmulas mesmo assim (ver ScoringService.withdrawPresentation).
          if (!complete && !entry.withdrawnAt) continue;

          const { finalResult, percentage } = entry.withdrawnAt
            ? { finalResult: 0, percentage: 0 }
            : await this.computePresentationResult(
                entry.id,
                category,
                deductionValueByType,
              );

          results.push({
            scheduleEntryId: entry.id,
            teamName: entry.teamName ?? 'Equipe',
            categoryName: entry.categoryName ?? '',
            resourceName: resource.name,
            dayDate: day.date,
            contestationRequested: !!entry.contestationRequestedAt,
            contestationResolved: !!entry.contestationResolvedAt,
            finalResult,
            percentage,
            withdrawn: !!entry.withdrawnAt,
          });
        }
      }
    }

    return results;
  }

  // Última nota de CADA jurado por critério (dentro de uma lista de
  // ScoreEvent já carregada) — quando mais de um jurado pontua o mesmo
  // critério (ex.: um jurado de legalidade que também julga um item, ou
  // dois jurados escalados no mesmo item por engano/redundância de
  // propósito), a nota do critério vira a MÉDIA das notas de cada
  // jurado. Substitui o comportamento antigo de "o último ScoreEvent
  // grava por cima, não importa de qual jurado" — que descartava
  // silenciosamente a nota de um dos jurados do resultado final, só por
  // ordem de chegada (ver CLAUDE.md). Usado tanto pelo total oficial
  // (computePresentationResult) quanto pelo detalhe por critério
  // (buildPresentationDetail).
  private computeAverageScoreByCriterion(
    scoreEvents: ScoreEvent[],
  ): Map<string, number> {
    const latestByCriterionJudge = new Map<string, Map<string, number>>();
    for (const event of scoreEvents) {
      if (event.kind !== ScoreEventKind.SCORE_SET) continue;
      if (!event.criterionId || event.value === null) continue;
      let byJudge = latestByCriterionJudge.get(event.criterionId);
      if (!byJudge) {
        byJudge = new Map();
        latestByCriterionJudge.set(event.criterionId, byJudge);
      }
      byJudge.set(event.judgeParticipationId, event.value);
    }

    const averageByCriterion = new Map<string, number>();
    for (const [criterionId, byJudge] of latestByCriterionJudge) {
      const values = Array.from(byJudge.values());
      const average = values.reduce((sum, v) => sum + v, 0) / values.length;
      averageByCriterion.set(criterionId, average);
    }
    return averageByCriterion;
  }

  // Nota de cada equipe da MESMA categoria em cada critério (comparação
  // só faz sentido dentro da mesma categoria — mesmo sistema de
  // pontuação) — alimenta tanto o indicador "Maior nota" do mobile
  // quanto os marcadores por equipe do slider do desktop (ver
  // ScoringCriterionView.bestScore/teamScores, ScoringCriteriaGroups.tsx,
  // ScoreBandSlider.tsx). `criterionIds` já vem restrito aos critérios
  // que o jurado está de fato vendo (assignedLeafIds) — não vale
  // computar comparação de um critério que ele nem enxerga.
  // `currentTeamId` é excluído só de `teamScores` (a própria equipe já
  // é representada pelo polegar do slider) — `bestScore` continua
  // considerando todas as equipes, igual antes.
  private async getCriterionComparisons(
    categoryId: string,
    criterionIds: string[],
    currentTeamId: string,
  ): Promise<
    Map<
      string,
      {
        bestScore: { value: number; teamNames: string[] } | null;
        teamScores: { value: number; teamName: string }[];
      }
    >
  > {
    if (criterionIds.length === 0) return new Map();

    // Desistências saem da comparação — mesmo critério já usado nos
    // resultados oficiais (uma apresentação desistida não tem nota de
    // verdade, não faz sentido "liderar" nada).
    const entries = await this.scheduleEntriesRepo.find({
      where: {
        categoryId,
        type: ScheduleEntryType.PRESENTATION,
        withdrawnAt: IsNull(),
      },
    });
    const entriesWithTeam = entries.filter((e) => e.teamId);
    if (entriesWithTeam.length === 0) return new Map();

    const teamIds = [...new Set(entriesWithTeam.map((e) => e.teamId!))];
    const teams = await this.teamsRepo.findBy({ id: In(teamIds) });
    const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

    const scoreEvents = await this.scoreEventsRepo.find({
      where: {
        scheduleEntryId: In(entriesWithTeam.map((e) => e.id)),
        kind: ScoreEventKind.SCORE_SET,
      },
      order: { clientCreatedAt: 'ASC' },
    });
    const eventsByEntry = new Map<string, ScoreEvent[]>();
    for (const event of scoreEvents) {
      const list = eventsByEntry.get(event.scheduleEntryId) ?? [];
      list.push(event);
      eventsByEntry.set(event.scheduleEntryId, list);
    }

    // criterionId -> valor arredondado -> equipes empatadas nesse
    // valor. Arredonda pra 1 casa decimal (mesma precisão exibida na
    // UI, `score.toFixed(1)`) antes de comparar — `ScoreEvent.value` é
    // float, e a MÉDIA de floats de vários jurados pode gerar ruído de
    // arredondamento binário que quebraria uma comparação de igualdade
    // direta (empate de verdade apareceria como "quase igual, mas não
    // é" e nunca seria detectado).
    const byCriterion = new Map<string, Map<number, Set<string>>>();
    // criterionId -> nota bruta (não arredondada) de cada OUTRA equipe —
    // vira um marcador por equipe no slider, posição calculada com a
    // mesma precisão da nota de verdade, não a arredondada usada só pra
    // detectar empate do líder.
    const teamScoresByCriterion = new Map<
      string,
      { value: number; teamName: string }[]
    >();
    for (const entry of entriesWithTeam) {
      const teamName = teamNameById.get(entry.teamId!);
      if (!teamName) continue;
      const averages = this.computeAverageScoreByCriterion(
        eventsByEntry.get(entry.id) ?? [],
      );
      for (const criterionId of criterionIds) {
        const value = averages.get(criterionId);
        if (value === undefined) continue;
        const rounded = Math.round(value * 10) / 10;
        let valuesForCriterion = byCriterion.get(criterionId);
        if (!valuesForCriterion) {
          valuesForCriterion = new Map();
          byCriterion.set(criterionId, valuesForCriterion);
        }
        const teamsAtValue = valuesForCriterion.get(rounded) ?? new Set<string>();
        teamsAtValue.add(teamName);
        valuesForCriterion.set(rounded, teamsAtValue);

        if (entry.teamId !== currentTeamId) {
          const list = teamScoresByCriterion.get(criterionId) ?? [];
          list.push({ value, teamName });
          teamScoresByCriterion.set(criterionId, list);
        }
      }
    }

    const comparisons = new Map<
      string,
      {
        bestScore: { value: number; teamNames: string[] } | null;
        teamScores: { value: number; teamName: string }[];
      }
    >();
    for (const criterionId of criterionIds) {
      const valuesForCriterion = byCriterion.get(criterionId);
      const bestScore = valuesForCriterion
        ? (() => {
            const maxValue = Math.max(...valuesForCriterion.keys());
            return {
              value: maxValue,
              teamNames: Array.from(valuesForCriterion.get(maxValue)!),
            };
          })()
        : null;
      comparisons.set(criterionId, {
        bestScore,
        teamScores: teamScoresByCriterion.get(criterionId) ?? [],
      });
    }
    return comparisons;
  }

  // Nota final (soma dos critérios + deduções, sempre negativas) e
  // percentual (sobre a meta de pontos do template) de UMA
  // apresentação — extraído da Página de Resultados pra ser reusado
  // também pelos overviews de Notas (admin/assessor e Programa), que
  // agora mostram esses números direto na lista, sem abrir o detalhe
  // por critério (ver AdminOverviewEntryView). Assume que a
  // apresentação já foi checada como 100% pontuada (isPresentationFullyScored)
  // antes de chamar — não recalcula essa checagem aqui.
  private async computePresentationResult(
    scheduleEntryId: string,
    category: Category,
    deductionValueByType: Map<DeductionType, number>,
  ): Promise<{
    totalScore: number;
    deductionsTotal: number;
    finalResult: number;
    maxScore: number;
    percentage: number;
  }> {
    const scoreEvents = await this.scoreEventsRepo.find({
      where: { scheduleEntryId },
      order: { clientCreatedAt: 'ASC' },
    });
    const scoreByCriterion = this.computeAverageScoreByCriterion(scoreEvents);
    const deductionAdds = new Map<string, ScoreEvent>();
    const undoneDeductionIds = new Set<string>();
    for (const event of scoreEvents) {
      if (event.kind === ScoreEventKind.DEDUCTION_ADD) {
        deductionAdds.set(event.id, event);
      } else if (event.kind === ScoreEventKind.DEDUCTION_REMOVE) {
        if (event.undoesEventId) undoneDeductionIds.add(event.undoesEventId);
      }
    }
    const totalScore = Array.from(scoreByCriterion.values()).reduce(
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
    return { totalScore, deductionsTotal, finalResult, maxScore, percentage };
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

          const {
            totalScore,
            deductionsTotal,
            finalResult,
            maxScore,
            percentage,
          } = await this.computePresentationResult(
            entry.id,
            category,
            deductionValueByType,
          );

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

    const presentationsByCategory = new Map<
      string,
      ResultsPresentationView[]
    >();
    for (const p of presentations) {
      const list = presentationsByCategory.get(p.categoryId) ?? [];
      list.push(p);
      presentationsByCategory.set(p.categoryId, list);
    }

    const categories: ResultsCategoryView[] = categoriesInOrder
      .filter((c) => presentationsByCategory.has(c.id))
      .map((c) => {
        const list = presentationsByCategory.get(c.id)!;
        const byPercentage = [...list].sort(
          (a, b) => b.percentage - a.percentage,
        );
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

  // Página de Resultados pública (ver ResultsController/EventResultsView
  // resposta) — admin/assessor/jurado sempre veem a apuração de
  // trabalho (mesma de getEventResults); programa/espectador só depois
  // que `Event.resultsReleasedAt` for ligado pelo admin (toggle
  // "Liberar resultado" em ReleaseFlagsPanel).
  async getPublicEventResults(
    eventId: string,
    userId: string,
  ): Promise<EventResultsResponse> {
    const { event, member } = await this.eventsService.getMemberForEventId(
      eventId,
      userId,
    );
    const alwaysReleasedRoles = [
      EventMemberRole.ADMIN,
      EventMemberRole.ASSESSOR,
      EventMemberRole.JUDGE,
    ];
    const isAlwaysReleased = !!member?.roles.some((r) =>
      alwaysReleasedRoles.includes(r),
    );
    const released = isAlwaysReleased || !!event.resultsReleasedAt;
    if (!released) return { released: false, results: null };
    return { released: true, results: await this.getEventResults(eventId) };
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
    return this.buildTeamScopedOverview(
      eventId,
      new Set(myTeams.map((t) => t.id)),
    );
  }

  // Visão do Atleta na tela de Notas — igual à do Programa
  // (getTeamOverview), só que filtrada pela UNIÃO dos times de TODOS os
  // programas com vínculo CONFIRMADO (ver AthletesService.
  // getConfirmedProgramUserIds — um atleta pode estar ligado a mais de
  // um programa). `locked: true` quando não há nenhum programa
  // confirmado com participação NESTE evento, ou quando as notas ainda
  // não foram liberadas globalmente — a tela mostra um aviso de "aguardando
  // confirmação" nesse caso, mesmo padrão de `EventResultsResponse.released`.
  async getAthleteOverview(
    eventId: string,
    userId: string,
  ): Promise<{ locked: boolean; entries: AdminOverviewEntryView[] }> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const programUserIds =
      await this.athletesService.getConfirmedProgramUserIds(userId);
    if (programUserIds.length === 0 || !event.scoresReleasedAt) {
      return { locked: true, entries: [] };
    }

    const participations = (
      await Promise.all(
        programUserIds.map((programUserId) =>
          this.programsService.findParticipationByUserId(
            eventId,
            programUserId,
          ),
        ),
      )
    ).filter((p): p is NonNullable<typeof p> => p !== null);
    if (participations.length === 0) return { locked: true, entries: [] };

    const myTeams = await this.teamsRepo.find({
      where: { programId: In(participations.map((p) => p.id)) },
    });
    const entries = await this.buildTeamScopedOverview(
      eventId,
      new Set(myTeams.map((t) => t.id)),
    );
    return { locked: false, entries };
  }

  // Loop compartilhado por getTeamOverview/getAthleteOverview — mesma
  // completude (isPresentationFullyScored) e cálculo de nota
  // (computePresentationResult) do overview do admin, só que restrito a
  // um conjunto de times.
  private async buildTeamScopedOverview(
    eventId: string,
    teamIds: Set<string>,
  ): Promise<AdminOverviewEntryView[]> {
    const days = await this.scheduleService.getDays(eventId);
    const regulation = await this.regulationsService.getForEvent(eventId);
    const deductionValueByType = new Map(
      regulation.deductions.map((r) => [r.type, r.value]),
    );
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
            !teamIds.has(entry.teamId) ||
            !entry.categoryId
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
          if (!complete && !entry.withdrawnAt) continue;

          const { finalResult, percentage } = entry.withdrawnAt
            ? { finalResult: 0, percentage: 0 }
            : await this.computePresentationResult(
                entry.id,
                category,
                deductionValueByType,
              );

          results.push({
            scheduleEntryId: entry.id,
            teamName: entry.teamName ?? 'Equipe',
            categoryName: entry.categoryName ?? '',
            resourceName: resource.name,
            dayDate: day.date,
            contestationRequested: !!entry.contestationRequestedAt,
            contestationResolved: !!entry.contestationResolvedAt,
            finalResult,
            percentage,
            withdrawn: !!entry.withdrawnAt,
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

  // Mesmo detalhe, mas pro Atleta — a apresentação precisa ser de uma
  // equipe de ALGUM dos programas com vínculo CONFIRMADO dele (ver
  // getAthleteOverview).
  async getAthletePresentationDetail(
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
    const event = await this.eventsService.findEventOrThrow(eventId);
    if (!event.scoresReleasedAt) {
      throw new ForbiddenException(
        'As notas deste evento ainda não foram liberadas.',
      );
    }
    const programUserIds =
      await this.athletesService.getConfirmedProgramUserIds(userId);
    const participations = (
      await Promise.all(
        programUserIds.map((programUserId) =>
          this.programsService.findParticipationByUserId(
            eventId,
            programUserId,
          ),
        ),
      )
    ).filter((p): p is NonNullable<typeof p> => p !== null);
    const team =
      participations.length > 0
        ? await this.teamsRepo.findOneBy({
            id: entry.teamId,
            programId: In(participations.map((p) => p.id)),
          })
        : null;
    if (!team) {
      throw new ForbiddenException(
        'Esta apresentação não pertence a um dos seus programas.',
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
    const participation = await this.assertJudgeParticipation(eventId, userId);
    const rows = await this.scoreEventsRepo.find({
      where: {
        judgeParticipationId: participation.id,
        kind: ScoreEventKind.SHEET_SUBMITTED,
      },
    });
    return Array.from(new Set(rows.map((r) => r.scheduleEntryId)));
  }

  // Ids das apresentações já 100% pontuadas — alimenta o cronograma ao
  // vivo (painel Início: "Próxima apresentação"/"Próximo em cada
  // pista"), que antes só comparava o horário AGENDADO contra o
  // relógio (ver lib/eventLiveSchedule.ts) e podia mostrar uma
  // apresentação já concluída como "próxima" quando os jurados
  // terminam mais rápido que a duração planejada. Reaproveita
  // getAdminOverview (que já filtra só as completas) em vez de
  // duplicar o loop de completude.
  async getCompletedPresentationIds(eventId: string): Promise<string[]> {
    const overview = await this.getAdminOverview(eventId);
    return overview.map((e) => e.scheduleEntryId);
  }

  // Horário real de início de cada apresentação já iniciada (primeiro
  // TIMER_STARTED — ver enum) — alimenta o card "Atraso atual" do
  // painel Início (comparação feita no frontend, que já tem toda a
  // lógica de hora agendada × relógio em lib/eventLiveSchedule.ts, sem
  // duplicar aqui). Uma linha por apresentação, só as que já foram
  // iniciadas por algum Jurado de Legalidade.
  async getStartedPresentations(
    eventId: string,
  ): Promise<Array<{ scheduleEntryId: string; startedAt: string }>> {
    const days = await this.scheduleService.getDays(eventId);
    const entryIds: string[] = [];
    for (const day of days) {
      for (const resource of day.resources) {
        for (const entry of resource.entries) {
          if (entry.type === ScheduleEntryType.PRESENTATION) {
            entryIds.push(entry.id);
          }
        }
      }
    }
    if (entryIds.length === 0) return [];

    const events = await this.scoreEventsRepo.find({
      where: {
        scheduleEntryId: In(entryIds),
        kind: ScoreEventKind.TIMER_STARTED,
      },
      order: { clientCreatedAt: 'ASC' },
    });
    const firstStartByEntry = new Map<string, Date>();
    for (const event of events) {
      if (!firstStartByEntry.has(event.scheduleEntryId)) {
        firstStartByEntry.set(event.scheduleEntryId, event.clientCreatedAt);
      }
    }
    return Array.from(firstStartByEntry.entries()).map(
      ([scheduleEntryId, startedAt]) => ({
        scheduleEntryId,
        startedAt: startedAt.toISOString(),
      }),
    );
  }

  // Jurado (comum ou Head Judge) só pode escrever na súmula
  // (nota/dedução/cronômetro/comentário/lançar) depois que o produtor
  // iniciar o evento de verdade (`Event.startedAt`/status `started`) —
  // decisão do usuário: antes disso as telas continuam abertas pra
  // consulta, só a escrita é que fica bloqueada.
  private async assertEventStarted(eventId: string): Promise<void> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    if (event.status !== EventStatus.STARTED) {
      throw new ConflictException('O evento ainda não foi iniciado.');
    }
  }

  // Recebe a fila (offline ou não) do buffer local do navegador —
  // idempotente por design (`id` vem do cliente): reenviar o mesmo
  // evento depois de uma falha de rede não duplica nada.
  async submitEvents(
    eventId: string,
    userId: string,
    events: ScoreEventInputDto[],
  ): Promise<{ savedIds: string[] }> {
    await this.assertEventStarted(eventId);
    const participation = await this.assertJudgeParticipation(eventId, userId);
    const rows = await this.buildScoreEventRows(
      eventId,
      participation.id,
      events,
    );

    const preExistingTimerStarts =
      await this.getEntryIdsWithExistingTimerStart(rows);

    if (rows.length > 0) {
      await this.scoreEventsRepo
        .createQueryBuilder()
        .insert()
        .into(ScoreEvent)
        .values(rows)
        .orIgnore() // ON CONFLICT (id) DO NOTHING — reenvio idempotente
        .execute();
    }

    await this.notifyAfterScoreEventsInserted(
      eventId,
      rows,
      preExistingTimerStarts,
    );

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
    await this.assertEventStarted(eventId);

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

    const preExistingTimerStarts =
      await this.getEntryIdsWithExistingTimerStart(rows);

    if (rows.length > 0) {
      await this.scoreEventsRepo
        .createQueryBuilder()
        .insert()
        .into(ScoreEvent)
        .values(rows)
        .orIgnore()
        .execute();
    }

    await this.notifyAfterScoreEventsInserted(
      eventId,
      rows,
      preExistingTimerStarts,
    );

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
        // Apresentação desistida não aceita mais nenhum ScoreEvent —
        // ver ScoringService.withdrawPresentation, que só permite
        // sinalizar desistência enquanto não existe nenhum evento ainda.
        if (entry.withdrawnAt) {
          throw new ForbiddenException(
            'Esta apresentação foi cancelada — não é mais possível lançar notas para ela.',
          );
        }
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
        input.kind === ScoreEventKind.TIMER_STARTED ||
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
        if (
          input.kind === ScoreEventKind.DEDUCTION_ADD &&
          !input.deductionType
        ) {
          throw new BadRequestException(
            'Evento de dedução precisa de deductionType.',
          );
        }
        if (
          input.kind === ScoreEventKind.DEDUCTION_REMOVE &&
          !input.undoesEventId
        ) {
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
            actingParticipationId &&
            actingParticipationId !== ownerParticipationId
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

  // Mesma checagem de `isPresentationFullyScored`, mas resolvendo o
  // contexto (categoria/atribuições/funções especiais) de UMA
  // apresentação só, em vez de iterar o dia inteiro (getAdminOverview) —
  // usado pelos gatilhos de notificação, que precisam checar uma
  // apresentação específica logo depois de um envio de súmula.
  private async isPresentationComplete(
    eventId: string,
    scheduleEntryId: string,
  ): Promise<boolean> {
    const { entry, category } = await this.loadPresentationContext(
      eventId,
      scheduleEntryId,
    );
    const [assignmentsState, specialRoles] = await Promise.all([
      this.judgingService.getAssignments(eventId, category.scoringTemplateId!),
      this.judgingService.getSpecialRoles(eventId, entry.resourceId),
    ]);
    return this.isPresentationFullyScored(
      entry.id,
      entry.resourceId,
      assignmentsState,
      specialRoles,
    );
  }

  // Dos `scheduleEntryId` com `TIMER_STARTED` no lote sendo gravado,
  // quais JÁ tinham algum `TIMER_STARTED` antes deste envio — usado por
  // `notifyAfterScoreEventsInserted` pra distinguir o primeiro início de
  // verdade (dispara "avaliação pendente" pras outras apresentações
  // ainda abertas) de um "Reiniciar" do cronômetro (não conta como novo
  // início, mesma regra que `getStartedPresentations` já usa pro
  // cálculo de atraso). Precisa ser consultado ANTES do insert do lote.
  private async getEntryIdsWithExistingTimerStart(
    rows: ScoreEvent[],
  ): Promise<Set<string>> {
    const entryIds = [
      ...new Set(
        rows
          .filter((r) => r.kind === ScoreEventKind.TIMER_STARTED)
          .map((r) => r.scheduleEntryId),
      ),
    ];
    if (entryIds.length === 0) return new Set();
    const existing = await this.scoreEventsRepo.find({
      where: {
        scheduleEntryId: In(entryIds),
        kind: ScoreEventKind.TIMER_STARTED,
      },
    });
    return new Set(existing.map((e) => e.scheduleEntryId));
  }

  // Dois gatilhos de notificação, checados depois de gravar um lote de
  // ScoreEvent (`submitEvents`/`submitEventsAsHeadJudge`, jurado normal
  // ou Head Judge editando folha de outro jurado — os dois passam por
  // aqui igual):
  // - "Apresentação concluída": pra cada SHEET_SUBMITTED do lote, se a
  //   apresentação acabou de ficar 100% pontuada (todos os jurados
  //   escalados já enviaram), notifica ALL. Dedup por scheduleEntryId —
  //   não duplica se o gatilho rodar de novo.
  // - "Avaliação pendente": pra cada TIMER_STARTED do lote que for o
  //   PRIMEIRO de verdade daquele scheduleEntryId (não um "Reiniciar"),
  //   busca outras apresentações do evento já iniciadas mas ainda não
  //   completas e notifica STAFF sobre CADA UMA delas (não sobre a que
  //   acabou de começar — é o lembrete "essa outra ainda está aberta").
  private async notifyAfterScoreEventsInserted(
    eventId: string,
    rows: ScoreEvent[],
    preExistingTimerStarts: Set<string>,
  ): Promise<void> {
    if (rows.length === 0) return;
    const event = await this.eventsService.findEventOrThrow(eventId);

    const submittedEntryIds = new Set(
      rows
        .filter((r) => r.kind === ScoreEventKind.SHEET_SUBMITTED)
        .map((r) => r.scheduleEntryId),
    );
    for (const scheduleEntryId of submittedEntryIds) {
      const alreadyNotified = await this.notificationsService.existsForEntry(
        event.aliasId,
        NotificationType.PRESENTATION_COMPLETED,
        scheduleEntryId,
      );
      if (alreadyNotified) continue;
      const complete = await this.isPresentationComplete(
        eventId,
        scheduleEntryId,
      ).catch(() => false);
      if (!complete) continue;
      const entry = await this.scheduleService.findEntryInEventOrThrow(
        eventId,
        scheduleEntryId,
      );
      const team = entry.teamId
        ? await this.teamsRepo.findOneBy({ id: entry.teamId })
        : null;
      await this.notificationsService.create(
        event.aliasId,
        NotificationType.PRESENTATION_COMPLETED,
        NotificationAudience.ALL,
        `Apresentação ${team?.name ?? 'Equipe'} concluída`,
        scheduleEntryId,
      );
    }

    const newlyStartedEntryIds = new Set(
      rows
        .filter(
          (r) =>
            r.kind === ScoreEventKind.TIMER_STARTED &&
            !preExistingTimerStarts.has(r.scheduleEntryId),
        )
        .map((r) => r.scheduleEntryId),
    );
    // "Apresentação iniciada" — dispara uma única vez, no PRIMEIRO
    // TIMER_STARTED de verdade de cada apresentação (mesmo critério de
    // "newlyStarted" acima — reiniciar o cronômetro não conta como novo
    // início). Diferente de "avaliação pendente" (só STAFF), esta é
    // visível pra todo mundo do evento.
    for (const scheduleEntryId of newlyStartedEntryIds) {
      const alreadyNotified = await this.notificationsService.existsForEntry(
        event.aliasId,
        NotificationType.PRESENTATION_STARTED,
        scheduleEntryId,
      );
      if (alreadyNotified) continue;
      const entry = await this.scheduleService.findEntryInEventOrThrow(
        eventId,
        scheduleEntryId,
      );
      const team = entry.teamId
        ? await this.teamsRepo.findOneBy({ id: entry.teamId })
        : null;
      await this.notificationsService.create(
        event.aliasId,
        NotificationType.PRESENTATION_STARTED,
        NotificationAudience.ALL,
        `Apresentação ${team?.name ?? 'Equipe'} iniciada`,
        scheduleEntryId,
      );
    }

    if (newlyStartedEntryIds.size === 0) return;

    const started = await this.getStartedPresentations(eventId);
    for (const other of started) {
      if (newlyStartedEntryIds.has(other.scheduleEntryId)) continue;
      const alreadyNotified = await this.notificationsService.existsForEntry(
        event.aliasId,
        NotificationType.EVALUATION_PENDING,
        other.scheduleEntryId,
      );
      if (alreadyNotified) continue;
      const complete = await this.isPresentationComplete(
        eventId,
        other.scheduleEntryId,
      ).catch(() => false);
      if (complete) continue;
      const entry = await this.scheduleService.findEntryInEventOrThrow(
        eventId,
        other.scheduleEntryId,
      );
      const team = entry.teamId
        ? await this.teamsRepo.findOneBy({ id: entry.teamId })
        : null;
      await this.notificationsService.create(
        event.aliasId,
        NotificationType.EVALUATION_PENDING,
        NotificationAudience.STAFF,
        `Avaliação de ${team?.name ?? 'Equipe'} pendente`,
        other.scheduleEntryId,
      );
    }
  }

  // Monta a visão combinada de UMA apresentação — todos os grupos do
  // sistema de pontuação + legalidade JUNTOS, mais o comentário/esboço
  // de cada jurado que deixou algo. Reusado por
  // `getAdminPresentationDetail` (sem restrição) e
  // `getTeamPresentationDetail` (já validado antes de chamar). Quando
  // um critério-folha tem mais de um jurado atribuído (o modelo
  // permite — ver CriterionJudgeAssignment), o valor mostrado é a
  // MÉDIA das notas de cada jurado (ver computeAverageScoreByCriterion)
  // — a pedido do usuário, essa tela mostra só a média, sem listar
  // jurado por jurado (diferente de `legality`/`notes` abaixo, que
  // continuam por jurado — lá um nome só faz sentido).
  private async buildPresentationDetail(
    eventId: string,
    scheduleEntryId: string,
  ): Promise<PresentationDetailView> {
    const { entry, category, team, resource, allCriteria } =
      await this.loadPresentationContext(eventId, scheduleEntryId);

    const [
      event,
      assignmentsState,
      specialRoles,
      allJudges,
      events,
      regulation,
    ] = await Promise.all([
      this.eventsService.findEventOrThrow(eventId),
      this.judgingService.getAssignments(eventId, category.scoringTemplateId!),
      this.judgingService.getSpecialRoles(eventId, entry.resourceId),
      this.judgesService.findAllForEvent(eventId),
      this.scoreEventsRepo.find({
        where: { scheduleEntryId: entry.id },
        order: { clientCreatedAt: 'ASC' },
      }),
      this.regulationsService.getForEvent(eventId),
    ]);

    const judgeNameById = new Map(allJudges.map((j) => [j.id, j.name]));

    const assignedLeafIds = new Set<string>();
    for (const assignment of assignmentsState.criterionAssignments) {
      if (assignment.resourceId !== entry.resourceId) continue;
      if (assignment.judgeIds.length === 0) continue;
      assignedLeafIds.add(assignment.criterionId);
    }

    const scoreByCriterion = this.computeAverageScoreByCriterion(events);
    const deductionAdds = new Map<string, ScoreEvent>();
    const undoneDeductionIds = new Set<string>();
    const lastCommentByJudge = new Map<string, string>();

    for (const event of events) {
      switch (event.kind) {
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
      if (!assignedLeafIds.has(criterion.id)) continue;

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

      const subgroupDescriptions: { name: string; description: string }[] =
        [];
      let ancestor = criterion.parentId ? byId.get(criterion.parentId) : undefined;
      while (ancestor && ancestor.id !== root.id) {
        if (ancestor.description) {
          subgroupDescriptions.push({
            name: ancestor.name,
            description: ancestor.description,
          });
        }
        ancestor = ancestor.parentId ? byId.get(ancestor.parentId) : undefined;
      }

      group.criteria.push({
        id: criterion.id,
        name: criterion.name,
        description: criterion.description,
        maxScore: criterion.maxScore,
        allowDecimalScoring: criterion.allowDecimalScoring,
        order: criterion.order,
        useScoreBands: criterion.useScoreBands,
        scoreBands: criterion.scoreBands,
        subgroupDescriptions,
        // Súmula de detalhe (drill-down admin/Programa) não mostra o
        // indicador de "maior nota"/marcadores por equipe — feature só
        // da folha ao vivo do próprio jurado (ver ScoringService.getSheet).
        bestScore: null,
        teamScores: [],
        value: scoreByCriterion.get(criterion.id) ?? null,
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

  // Ids das equipes do Programa chamador neste evento — usado pelo
  // frontend do cronograma (EventLiveSchedulePage) pra decidir em quais
  // linhas mostrar a opção "Sinalizar desistência" (só nas apresentações
  // das próprias equipes). Rota bem enxuta de propósito — não é o
  // overview completo (que só lista apresentação já pontuada), só os
  // ids mesmo.
  async getMyTeamIds(eventId: string, userId: string): Promise<string[]> {
    const participation = await this.assertProgramParticipation(
      eventId,
      userId,
    );
    const myTeams = await this.teamsRepo.find({
      where: { programId: participation.id },
    });
    return myTeams.map((t) => t.id);
  }

  // Fluxo de desistência (2026-07-26) — admin/assessor pode sinalizar
  // desistência de QUALQUER apresentação do evento; programa só das
  // apresentações das próprias equipes (jurado/atleta/espectador não
  // podem). Em ambos os casos só é permitido enquanto a apresentação
  // não tiver NENHUM ScoreEvent — "avaliada" aqui é qualquer sinal de
  // que já começou (inclusive só o cronômetro do Jurado de Legalidade),
  // não só nota lançada. `removeFromSchedule` só tem efeito pra
  // admin/assessor — vem sempre `false` pra programa, mesmo que o DTO
  // mande outra coisa (não é decisão do programa).
  async withdrawPresentation(
    eventId: string,
    userId: string,
    scheduleEntryId: string,
    dto: WithdrawPresentationDto,
  ): Promise<void> {
    const entry = await this.scheduleService.findEntryInEventOrThrow(
      eventId,
      scheduleEntryId,
    );
    if (entry.type !== ScheduleEntryType.PRESENTATION) {
      throw new BadRequestException(
        'Este item do cronograma não é uma apresentação.',
      );
    }
    if (entry.withdrawnAt) {
      throw new ConflictException(
        'Esta apresentação já foi marcada como desistência.',
      );
    }

    const { member } = await this.eventsService.getMemberForEventId(
      eventId,
      userId,
    );
    const isStaff = !!member?.roles.some(
      (r) => r === EventMemberRole.ADMIN || r === EventMemberRole.ASSESSOR,
    );
    let removeFromSchedule = false;
    if (isStaff) {
      removeFromSchedule = !!dto.removeFromSchedule;
    } else if (member?.roles.includes(EventMemberRole.PROGRAM)) {
      if (!entry.teamId) {
        throw new ForbiddenException(
          'Esta apresentação não pertence ao seu programa.',
        );
      }
      await this.assertProgramOwnsTeam(eventId, userId, entry.teamId);
    } else {
      throw new ForbiddenException(
        'Você não tem permissão para sinalizar desistência.',
      );
    }

    const alreadyEvaluated = await this.scoreEventsRepo.count({
      where: { scheduleEntryId },
    });
    if (alreadyEvaluated > 0) {
      throw new ConflictException(
        'Esta apresentação já começou a ser avaliada — não é mais possível sinalizar desistência.',
      );
    }

    await this.scheduleService.setWithdrawn(eventId, scheduleEntryId, {
      removeFromSchedule,
    });
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
    const participation = await this.assertJudgeParticipation(eventId, userId);
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

    const allCriteria =
      await this.scoringCriteriaService.findAllForTemplateUnchecked(
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
        group = {
          id: root.id,
          name: root.name,
          description: root.description,
          criteria: [],
        };
        groups.set(root.id, group);
      }
      const subgroupDescriptions: { name: string; description: string }[] =
        [];
      let ancestor = leaf.parentId ? byId.get(leaf.parentId) : undefined;
      while (ancestor && ancestor.id !== root.id) {
        if (ancestor.description) {
          subgroupDescriptions.push({
            name: ancestor.name,
            description: ancestor.description,
          });
        }
        ancestor = ancestor.parentId ? byId.get(ancestor.parentId) : undefined;
      }

      group.criteria.push({
        id: leaf.id,
        name: leaf.name,
        description: leaf.description,
        maxScore: leaf.maxScore,
        allowDecimalScoring: leaf.allowDecimalScoring,
        order: leaf.order,
        useScoreBands: leaf.useScoreBands,
        scoreBands: leaf.scoreBands,
        subgroupDescriptions,
        // Placeholder — só `getSheet` (folha do próprio jurado) de
        // fato calcula isso (ver getCriterionComparisons), sobrescrevendo
        // depois desta chamada. `getSheetForJudge` (Head Judge) nunca
        // mostra essa feature (`showScoreBands=false` no frontend),
        // então nem vale a query extra pra ele.
        bestScore: null,
        teamScores: [],
      });
    }

    for (const group of groups.values()) {
      group.criteria.sort((a, b) => a.order - b.order);
    }

    return Array.from(groups.values());
  }
}

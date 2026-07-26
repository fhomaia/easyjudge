import type { Category, JudgeAssignmentsSummary, ScheduleDay, ScheduleEntry } from "@/api/client";
import { SPECIAL_JUDGE_ROLES } from "@/lib/specialJudgeRoles";
import { computeResourceTimes } from "@/lib/scheduleTime";

// Rótulos de "Minhas funções" (EventLiveNotesPage) — grupos de
// critério + funções especiais (Head Judge/Legalidade) do jurado.
export function functionLabelsFor(assignment: JudgeAssignmentsSummary): string[] {
  return [
    ...assignment.criterionGroups,
    ...assignment.specialRoles.map(
      (role) => SPECIAL_JUDGE_ROLES.find((r) => r.role === role)?.label ?? role,
    ),
  ];
}

// Uma apresentação é "minha" (jurado logado) se: (a) tenho uma função
// especial (Head Judge/Legalidade) nesse recurso — cobre QUALQUER
// apresentação da pista, independente de categoria/template — ou (b)
// tenho ao menos um critério-folha atribuído nesse recurso, PARA O
// TEMPLATE que a categoria dessa apresentação usa (ver
// JudgeAssignmentsSummary.criterionResourceTemplates).
export function isMyPresentation(
  entry: ScheduleEntry,
  categoriesById: Map<string, Category>,
  assignment: JudgeAssignmentsSummary,
): boolean {
  if (entry.type !== "presentation") return false;
  if (assignment.resourceIds.includes(entry.resourceId)) return true;
  const templateId = entry.categoryId ? (categoriesById.get(entry.categoryId)?.scoringTemplateId ?? null) : null;
  if (!templateId) return false;
  return assignment.criterionResourceTemplates.some(
    (p) => p.resourceId === entry.resourceId && p.templateId === templateId,
  );
}

export interface JudgePresentationItem {
  entry: ScheduleEntry;
  resourceName: string;
  dayDate: string;
  start: number;
  end: number;
  // Vem de um sinal real (ScoreEventKind.SHEET_SUBMITTED, emitido ao
  // clicar "Lançar notas" — ver scoringApi.getMySubmissions), não de
  // comparação com o relógio (ao contrário de computeEventLiveSchedule/
  // isItemDone em eventLiveSchedule.ts, que é interinamente baseado em
  // horário e não deve ser tocado por esta mudança).
  submitted: boolean;
}

// Lista de TODAS as apresentações do jurado logado, na ordem do
// cronograma (dia, depois horário dentro do dia) — usada pela tela de
// Notas pra listar tudo de uma vez (com badge "Próxima"/"Concluída"),
// em vez de só as próximas. Horário calculado com TODOS os itens de
// cada recurso (não só os meus) — a duração acumulada de uma pista
// depende de tudo que vem antes nela, inclusive itens que não são meus.
export function buildJudgePresentationList(
  days: ScheduleDay[],
  categoriesById: Map<string, Category>,
  assignment: JudgeAssignmentsSummary,
  submittedEntryIds: Set<string>,
): JudgePresentationItem[] {
  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const items: JudgePresentationItem[] = [];

  for (const day of sortedDays) {
    const times = computeResourceTimes(day.resources, day.startMinutes);
    for (const resource of day.resources) {
      for (const entry of resource.entries) {
        if (!isMyPresentation(entry, categoriesById, assignment)) continue;
        const t = times.get(entry.id);
        if (!t) continue;
        items.push({
          entry,
          resourceName: resource.name,
          dayDate: day.date,
          start: t.startMinutes,
          end: t.endMinutes,
          submitted: submittedEntryIds.has(entry.id),
        });
      }
    }
  }

  items.sort((a, b) => (a.dayDate === b.dayDate ? a.start - b.start : a.dayDate < b.dayDate ? -1 : 1));
  return items;
}

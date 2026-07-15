import { judgingApi, scoringCriteriaApi } from "@/api/client";

export interface TemplateJudgingStats {
  total: number;
  assigned: number;
}

// Busca, pra cada template informado, quantas folhas (itens de
// avaliação) existem e quantas já têm ao menos um jurado atribuído
// nesse evento — usado tanto pela barra "sistemas de pontuação
// completos" (JudgingPage) quanto pela etapa "Painel de jurados" do
// checklist de setup (EventSetupPage), que só considera a escala de
// arbitragem concluída quando todo template está 100% coberto.
export async function fetchTemplateJudgingStats(
  eventId: string,
  templateIds: string[],
): Promise<Map<string, TemplateJudgingStats>> {
  const entries = await Promise.all(
    templateIds.map(async (templateId) => {
      const [criteriaList, assignments] = await Promise.all([
        scoringCriteriaApi.list(templateId),
        judgingApi.getAssignments(eventId, templateId),
      ]);
      const leafIds = criteriaList.filter((c) => c.type === "score_item").map((c) => c.id);
      const assignedIds = new Set(
        assignments.criterionAssignments
          .filter((a) => a.judgeIds.length > 0)
          .map((a) => a.criterionId),
      );
      const assigned = leafIds.filter((leafId) => assignedIds.has(leafId)).length;
      return [templateId, { total: leafIds.length, assigned }] as const;
    }),
  );
  return new Map(entries);
}

export function isTemplateJudgingComplete(stats?: TemplateJudgingStats): boolean {
  return !!stats && stats.total > 0 && stats.assigned === stats.total;
}

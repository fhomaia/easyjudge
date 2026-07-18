import { judgingApi, scoringCriteriaApi } from "@/api/client";

export interface TemplateJudgingStats {
  total: number;
  assigned: number;
}

// Busca, pra cada template informado, quantos "slots" existem (folha
// × recurso — um jurado não cobre duas pistas ao mesmo tempo, ver
// judgingAssignments.ts) somando TODOS os dias em que categorias desse
// template têm apresentação agendada, e quantos já têm ao menos um
// jurado atribuído nesse evento — usado tanto pela barra "sistemas de
// pontuação completos" (JudgingPage) quanto pela etapa "Painel de
// jurados" do checklist de setup (EventSetupPage), que só considera a
// escala de arbitragem concluída quando todo template está 100%
// coberto. Um template sem nenhum dia com apresentação agendada tem
// `total: 0` (não é considerado completo — ver isTemplateJudgingComplete).
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
      const resourceIds = assignments.days.flatMap((day) => day.resources.map((r) => r.id));
      const assignedResourceIdsByCriterion = new Map<string, Set<string>>();
      for (const a of assignments.criterionAssignments) {
        if (a.judgeIds.length === 0) continue;
        const set = assignedResourceIdsByCriterion.get(a.criterionId) ?? new Set<string>();
        set.add(a.resourceId);
        assignedResourceIdsByCriterion.set(a.criterionId, set);
      }
      let assigned = 0;
      for (const leafId of leafIds) {
        const assignedResourceIds = assignedResourceIdsByCriterion.get(leafId);
        if (!assignedResourceIds) continue;
        for (const resourceId of resourceIds) {
          if (assignedResourceIds.has(resourceId)) assigned++;
        }
      }
      return [templateId, { total: leafIds.length * resourceIds.length, assigned }] as const;
    }),
  );
  return new Map(entries);
}

export function isTemplateJudgingComplete(stats?: TemplateJudgingStats): boolean {
  return !!stats && stats.total > 0 && stats.assigned === stats.total;
}

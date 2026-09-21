import type { DeductionRuleView, DeductionType } from "@/api/client";

// Nomes dos 9 tipos padrão IASF — só usado como fallback. O nome de um
// tipo (padrão ou personalizado) vem da API (`DeductionRuleView.label`).
const BUILT_IN_DEDUCTION_LABELS: Record<string, string> = {
  athlete_fall: "Athlete Fall",
  major_athlete_fall: "Major Athlete Fall",
  building_bobble: "Building Bobble",
  building_fall: "Building Fall",
  major_building_fall: "Major Building Fall",
  legality_infractions: "Legality Infractions",
  skill_out_of_level: "Skill Performed Out of Level",
  time_limit_violations: "Time Limit Violations",
  boundary_violations: "Boundary Violations",
};

// Nome de um tipo de dedução: prefere a lista de regras do regulamento
// (cobre os personalizados); cai no nome padrão e, por último, num
// rótulo genérico (tipo apagado do regulamento) — nunca quebra a tela.
export function getDeductionLabel(
  type: DeductionType,
  rules?: DeductionRuleView[],
): string {
  return (
    rules?.find((r) => r.type === type)?.label ??
    BUILT_IN_DEDUCTION_LABELS[type] ??
    "Dedução removida"
  );
}

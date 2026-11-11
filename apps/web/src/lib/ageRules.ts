import type { CategoryRules } from "@/api/client";

// Mesma regra da API (programs/age-rules.ts): idade completa na data de
// referência da categoria (aniversário no próprio dia conta).
export function ageAt(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = onDate.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

// Motivo de não poder entrar na categoria pela idade; null = pode (ou a
// categoria não tem regra de idade).
export function ageProblem(rules: CategoryRules | undefined, birthDate: string | null): string | null {
  if (!rules || (rules.minAge == null && rules.maxAge == null) || !rules.ageCutoffDate) return null;
  if (!birthDate) return "Informe sua data de nascimento";
  const age = ageAt(birthDate, rules.ageCutoffDate);
  if (rules.minAge != null && age < rules.minAge) return `Idade mínima: ${rules.minAge} anos`;
  if (rules.maxAge != null && age > rules.maxAge) return `Idade máxima: ${rules.maxAge} anos`;
  return null;
}

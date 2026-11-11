import type { CategoryRules } from '../categories/entities/category.entity';

// Idade completa na data (aniversário na própria data conta).
export function ageAt(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = onDate.split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

// Motivo de um atleta não poder entrar numa categoria pela regra de
// idade; null = elegível (ou categoria sem regra de idade). Mesmas
// mensagens da tela (EventRegistrationPage, popup de atletas).
export function ageProblem(
  rules: CategoryRules,
  birthDate: string | null,
): string | null {
  if ((rules.minAge == null && rules.maxAge == null) || !rules.ageCutoffDate) {
    return null;
  }
  if (!birthDate) return 'Data de nascimento obrigatória para a categoria.';
  const age = ageAt(birthDate, rules.ageCutoffDate);
  if (rules.minAge != null && age < rules.minAge) {
    return `Não tem a idade mínima (${rules.minAge} anos).`;
  }
  if (rules.maxAge != null && age > rules.maxAge) {
    return `Idade superior ao máximo permitido (${rules.maxAge} anos).`;
  }
  return null;
}

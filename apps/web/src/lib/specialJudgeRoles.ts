import type { SpecialJudgeRole } from "@/api/client";

interface SpecialRoleDefinition {
  role: SpecialJudgeRole;
  label: string;
  description: string;
  // Obrigatório pro cadastro do painel de jurados ser considerado
  // completo (ver EventSetupPage/eventSetupSteps.ts).
  required?: boolean;
}

// Rótulos/descrições ficam só no frontend (mesmo padrão de
// ROLE_LABELS/deductionLabels) — o backend manda só a chave do enum.
// No futuro outras funções especiais podem entrar aqui sem mudar mais
// nada além desta lista + o enum do backend.
export const SPECIAL_JUDGE_ROLES: SpecialRoleDefinition[] = [
  {
    role: "legality_judge",
    label: "Jurado de Legalidade",
    description: "Responsável por checar a legalidade dos elementos executados.",
    required: true,
  },
  {
    role: "head_judge",
    label: "Head Judge",
    description: "Responsável geral pela mesa de jurados do evento.",
  },
];

import type { EventMemberRole } from "@/api/client";

// Rótulos/descrições ficam só no frontend (mesmo padrão de
// ROLE_LABELS/specialJudgeRoles) — o backend manda só a chave do enum.
export const EVENT_MEMBER_ROLE_LABELS: Record<EventMemberRole, string> = {
  admin: "Admin",
  assessor: "Assessor",
  judge: "Jurado",
  spectator: "Espectador",
};

export const EVENT_MEMBER_ROLE_DESCRIPTIONS: Record<EventMemberRole, string> = {
  admin:
    "Edita as configurações do evento e pode adicionar ou remover qualquer pessoa (exceto o dono do evento).",
  assessor:
    "Edita as configurações do evento, mas não mexe em papéis nem em quem faz parte dele (exceto jurados, pelo Painel de Jurados).",
  judge:
    "Só enxerga o evento depois de publicado. Não edita configurações — visualiza os sistemas de pontuação.",
  spectator: "Só enxerga o evento depois de publicado. Não edita nada.",
};

export const EVENT_MEMBER_ROLES_ORDER: EventMemberRole[] = [
  "admin",
  "assessor",
  "judge",
  "spectator",
];

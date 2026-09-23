import type { EventMemberRole } from "@/api/client";

// Espelha EVENT_STAFF_ROLES do backend (apps/api/src/events/constants/
// event-staff-roles.ts) — únicos papéis que enxergam e acessam um
// evento ainda "created" (rascunho). Quem não tem nenhum desses papéis
// vê o card na Home como "Em breve", sem conseguir abrir (ver
// EventListItem/EventGridItem).
export const EVENT_STAFF_ROLES: EventMemberRole[] = ["admin", "assessor", "judge"];

export function hasEventStaffRole(roles: EventMemberRole[]): boolean {
  return roles.some((r) => EVENT_STAFF_ROLES.includes(r));
}

// Rótulos/descrições ficam só no frontend (mesmo padrão de
// ROLE_LABELS/specialJudgeRoles) — o backend manda só a chave do enum.
export const EVENT_MEMBER_ROLE_LABELS: Record<EventMemberRole, string> = {
  admin: "Admin",
  assessor: "Assessor",
  judge: "Jurado",
  spectator: "Espectador",
  program: "Programa",
  athlete: "Atleta",
};

export const EVENT_MEMBER_ROLE_DESCRIPTIONS: Record<EventMemberRole, string> = {
  admin:
    "Edita as configurações do evento e pode adicionar ou remover qualquer pessoa (exceto o dono do evento).",
  assessor:
    "Edita as configurações do evento, mas não mexe em papéis nem em quem faz parte dele (exceto jurados, pelo Painel de Jurados).",
  judge:
    "Enxerga o evento mesmo antes de publicado. Não edita configurações — visualiza os sistemas de pontuação.",
  spectator:
    "Aparece na lista como \"Em breve\" antes de publicado; só acessa o evento de fato depois. Não edita nada.",
  program:
    "Concedido automaticamente a programas vinculados ao evento — vê só as notas das próprias equipes, quando liberadas.",
  athlete:
    "Concedido automaticamente a atletas vinculados a um programa do evento — vê só as notas das próprias equipes, quando o vínculo é confirmado.",
};

// "program"/"athlete" ficam de fora — são concedidos automaticamente
// (ver ProgramsService/AthletesService), não são papéis que o admin
// atribui manualmente pelo roster de acessos (EventStaffPage).
// "spectator" saiu de propósito (2026-08-05): virou redundante desde o
// fluxo de compartilhamento por código/QR (ShareEventDialog/
// JoinByCodeDialog) — convidar espectador manualmente aqui não faz mais
// sentido, e o roster de acessos passou a listar só quem de fato ajuda
// a organizar o evento (ver EventStaffService.STAFF_ROLES, backend).
export const EVENT_MEMBER_ROLES_ORDER: EventMemberRole[] = [
  "admin",
  "assessor",
  "judge",
];

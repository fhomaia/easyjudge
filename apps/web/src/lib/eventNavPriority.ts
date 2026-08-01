import type { EventMemberRole } from "@/api/client";

// Qual aba fica centralizada no menu do evento ao vivo (mobile: 3ª de
// 5 posições; desktop: mesma ordem na sidebar), conforme o papel mais
// relevante do usuário logado NESTE evento. Prioridade pedida pelo
// usuário: admin > assessor > jurado > equipe > atleta — só
// admin/assessor/judge existem como EventMemberRole hoje ("equipe"/
// "atleta" ainda não têm papel próprio; caem no default "resultados"
// até essas jornadas existirem).
export function resolveCenterTab(roles: EventMemberRole[]): "resultados" | "notas" {
  if (roles.includes("admin") || roles.includes("assessor")) return "resultados";
  if (roles.includes("judge")) return "notas";
  return "resultados";
}

// Pra onde a aba "Notas" da navegação do evento ao vivo deve levar —
// admin/assessor/judge (e quem acumula programa com qualquer um
// desses) sempre vão pro hub "/live/notes" (resolve a visão certa
// internamente, ver EventLiveNotesPage). Só quem é EXCLUSIVAMENTE
// programa tem tela própria, "/live/team" (EventLiveTeamNotesPage).
// Reusada também por notificationHref (ver lib/notificationDisplay.ts)
// pra notificações de "notas"/"contestação liberadas".
export function resolveNotesHref(eventId: string, roles: EventMemberRole[]): string {
  const onlyProgram =
    roles.includes("program") &&
    !roles.some((r) => r === "admin" || r === "assessor" || r === "judge");
  return onlyProgram ? `/events/${eventId}/live/team` : `/events/${eventId}/live/notes`;
}

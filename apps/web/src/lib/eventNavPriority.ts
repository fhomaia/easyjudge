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

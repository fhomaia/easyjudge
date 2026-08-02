import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { eventsApi } from "@/api/client";

// Páginas "ao vivo" do evento (Início/Cronograma/Notas — ver
// EventLiveDashboardPage/EventLiveSchedulePage/EventLiveNotesPage) são
// pra quem TRABALHA no evento (admin/assessor/jurado/equipe) —
// diferente de useEventSetupGuard (só admin/assessor, telas de
// configuração). "program" entrou em 2026-07-25: é o papel que todo
// Programa vinculado ganha automaticamente (ver
// ProgramsService.create/linkUnclaimedProgramsByEmail), usado pela
// visão da equipe na tela de notas (EventLiveTeamNotesPage).
// "athlete" entrou em 2026-07-26: concedido a todo AthleteLink com os
// dois lados resolvidos, independente de confirmado pelo programa (ver
// EventMemberRole.ATHLETE) — já libera Início/Cronograma/Resultados;
// a confirmação só gateia o CONTEÚDO de Notas (checado dentro da
// própria página, não aqui no guard — a rota fica acessível, só o
// conteúdo é que aparece bloqueado). "spectator" (espectador genérico,
// sem vínculo com equipe) deliberadamente NÃO entra aqui por padrão —
// só quem passa `allowSpectator: true` libera. Exceções, uma por
// página que já chama com `allowSpectator: true`: EventLiveResultsPage
// (resultado é uma tela "ao vivo" que espectador genérico pode acessar
// desde sempre, a página decide se mostra o conteúdo ou um aviso de
// "em breve" via `Event.resultsReleasedAt`, ver
// ScoringService.getPublicEventResults); EventLiveDashboardPage
// (Início), desde 2026-08-01, pedido do usuário pra ficar disponível a
// todo tipo de usuário; e, desde 2026-08-02 (bug reportado: atleta
// removido pela equipe cai pra SPECTATOR, ver
// AthletesService.revokeEventAccessForLink, e era redirecionado pra
// Home ao clicar em Notas — mesmo problema valia pra qualquer
// espectador genérico, não só atleta removido), EventLiveNotesPage,
// EventLiveSchedulePage e EventLiveNotificationsPage. Cada endpoint
// que essas páginas consomem precisa aceitar SPECTATOR no próprio
// guard também (ex: EventTeamsController), senão a página deixa de
// redirecionar mas fica com dado vazio/errado (fetch 403 caindo no
// fallback silencioso do frontend) — checar isso é o primeiro passo
// antes de liberar `allowSpectator` numa página nova.
export function useEventLiveGuard(
  eventId: string | undefined,
  options?: { allowSpectator?: boolean },
) {
  const navigate = useNavigate();
  const allowSpectator = options?.allowSpectator ?? false;

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    eventsApi
      .get(eventId)
      .then((event) => {
        if (cancelled) return;
        const allowed = event.currentUserRoles.some(
          (r) =>
            r === "admin" ||
            r === "assessor" ||
            r === "judge" ||
            r === "program" ||
            r === "athlete" ||
            (allowSpectator && r === "spectator"),
        );
        if (!allowed) navigate("/", { replace: true });
      })
      .catch(() => {
        if (!cancelled) navigate("/", { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, navigate, allowSpectator]);
}

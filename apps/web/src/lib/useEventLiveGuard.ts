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
// "spectator" (espectador genérico, sem vínculo com equipe)
// deliberadamente NÃO entra aqui por padrão — só admin/assessor/
// jurado/equipe (e, futuramente, atleta) têm acesso à maioria dessas
// telas. Exceção: EventLiveResultsPage passa `allowSpectator: true`,
// já que resultado é a única tela "ao vivo" que espectador (e, futuramente,
// atleta) pode acessar — a página em si decide se mostra o conteúdo
// ou um aviso de "em breve" via `Event.resultsReleasedAt` (ver
// ScoringService.getPublicEventResults).
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

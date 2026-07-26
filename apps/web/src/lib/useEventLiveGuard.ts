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
// deliberadamente NÃO entra aqui — só admin/assessor/jurado/equipe (e,
// futuramente, atleta) têm acesso a essas telas.
export function useEventLiveGuard(eventId: string | undefined) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    eventsApi
      .get(eventId)
      .then((event) => {
        if (cancelled) return;
        const allowed = event.currentUserRoles.some(
          (r) => r === "admin" || r === "assessor" || r === "judge" || r === "program",
        );
        if (!allowed) navigate("/", { replace: true });
      })
      .catch(() => {
        if (!cancelled) navigate("/", { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, navigate]);
}

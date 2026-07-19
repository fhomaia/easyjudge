import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { eventsApi } from "@/api/client";

// Páginas de configuração do evento (setup: categorias, programas,
// regulamento, cronograma, escala de arbitragem, acessos) são só pra
// admin/assessor — jurado/espectador só enxergam o evento depois de
// publicado, e mesmo assim não editam nada daqui (2026-07-19, a pedido
// do usuário). Sem tela própria pra jurado/espectador ainda (jornada
// deles fica pra depois), então a saída é redirecionar pra Home em vez
// de mostrar uma página vazia/quebrada.
//
// Busca o evento por conta própria (mesmo que a página já tenha seu
// próprio fetch) — mantém uma interface só, independente de como cada
// página já busca (ou não) o evento.
export function useEventSetupGuard(eventId: string | undefined) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    eventsApi
      .get(eventId)
      .then((event) => {
        if (cancelled) return;
        const allowed = event.currentUserRoles.some(
          (r) => r === "admin" || r === "assessor",
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

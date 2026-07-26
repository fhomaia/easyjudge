import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { AdminNotesOverviewList } from "@/components/scoring/AdminNotesOverviewList";
import { PresentationNotesDetail } from "@/components/scoring/PresentationNotesDetail";
import { useEventLiveGuard } from "@/lib/useEventLiveGuard";
import { eventsApi, teamScoringApi, type AdminOverviewEntry, type Event, type PresentationDetail } from "@/api/client";
import { useAuthStore } from "@/store/auth";

// Visão do Programa (dono da equipe) sobre as notas das próprias
// equipes — só aparecem apresentações já liberadas
// (`scoresReleasedAt`). Tela enxuta de propósito (sem AppSidebar/nav
// completo): público novo, só esta tela por ora, mesmo espírito
// minimalista de EventLiveScoringPage.
export function EventLiveTeamNotesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  useEventLiveGuard(id);

  const [event, setEvent] = useState<Event | null>(null);
  const [entries, setEntries] = useState<AdminOverviewEntry[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PresentationDetail | null>(null);
  const [contesting, setContesting] = useState(false);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then(setEvent).catch(() => setEvent(null));
    teamScoringApi.getOverview(id).then(setEntries).catch(() => setEntries([]));
  }, [id]);

  useEffect(() => {
    if (!id || !selectedId) {
      setDetail(null);
      return;
    }
    teamScoringApi.getDetail(id, selectedId).then(setDetail);
  }, [id, selectedId]);

  async function handleContest() {
    if (!id || !selectedId) return;
    setContesting(true);
    await teamScoringApi.contest(id, selectedId);
    // Também recarrega a lista (não só o detalhe aberto) — senão o
    // badge "Contestação" na lista fica desatualizado até um reload
    // manual da página.
    const [refreshedDetail, refreshedEntries] = await Promise.all([
      teamScoringApi.getDetail(id, selectedId),
      teamScoringApi.getOverview(id),
    ]);
    setDetail(refreshedDetail);
    setEntries(refreshedEntries);
    setContesting(false);
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (!event || !entries) {
    return (
      <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-foreground">{event.name}</p>
          <p className="truncate text-xs text-muted-foreground">Notas das minhas equipes</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
        >
          Sair
        </button>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4">
        {selectedId && detail ? (
          <div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              Voltar
            </button>
            <PresentationNotesDetail
              detail={detail}
              actions={
                detail.contestationReleased && !detail.contestationRequested ? (
                  <button
                    type="button"
                    onClick={() => void handleContest()}
                    disabled={contesting}
                    className="w-full rounded-xl border border-red-300 bg-red-500/5 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-60"
                  >
                    {contesting ? "Enviando..." : "Solicitar contestação"}
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <AdminNotesOverviewList entries={entries} onSelect={setSelectedId} />
        )}
      </main>
    </div>
  );
}

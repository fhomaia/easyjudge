import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminNotesOverviewList } from "@/components/scoring/AdminNotesOverviewList";
import { AdminPresentationDetailPanel } from "@/components/scoring/AdminPresentationDetailPanel";
import { ReleaseFlagsPanel } from "@/components/scoring/ReleaseFlagsPanel";
import { adminScoringApi, type AdminOverviewEntry } from "@/api/client";

// Visão do admin/assessor na tela de Notas — painel de liberação
// global do evento + lista de apresentações 100% pontuadas → detalhe
// somente-leitura. Auto-contido (busca os próprios dados) pra caber
// tanto no branch mobile de EventLiveNotesPage quanto em
// EventLiveNotesDesktopView sem duplicar lógica de fetch/estado entre
// os dois.
interface AdminNotesOverviewProps {
  eventId: string;
}

export function AdminNotesOverview({ eventId }: AdminNotesOverviewProps) {
  const [entries, setEntries] = useState<AdminOverviewEntry[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    adminScoringApi.getOverview(eventId).then(setEntries);
  }, [eventId]);

  if (selectedId) {
    return (
      <AdminPresentationDetailPanel
        eventId={eventId}
        scheduleEntryId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div>
      <ReleaseFlagsPanel eventId={eventId} />
      {!entries ? (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <AdminNotesOverviewList entries={entries} onSelect={setSelectedId} />
      )}
    </div>
  );
}

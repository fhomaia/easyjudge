import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { AdminNotesOverviewList } from "@/components/scoring/AdminNotesOverviewList";
import { AdminPresentationDetailPanel } from "@/components/scoring/AdminPresentationDetailPanel";
import { ReleaseFlagsPanel } from "@/components/scoring/ReleaseFlagsPanel";
import { Button } from "@/components/ui/button";
import { downloadPresentationDetailsAsZip, slugify } from "@/lib/presentationDetailExport";
import { adminScoringApi, type AdminOverviewEntry } from "@/api/client";

// Visão do admin/assessor na tela de Notas — painel de liberação
// global do evento + lista de apresentações 100% pontuadas → detalhe
// somente-leitura. Auto-contido (busca os próprios dados) pra caber
// tanto no branch mobile de EventLiveNotesPage quanto em
// EventLiveNotesDesktopView sem duplicar lógica de fetch/estado entre
// os dois.
interface AdminNotesOverviewProps {
  eventId: string;
  eventName: string;
}

export function AdminNotesOverview({ eventId, eventName }: AdminNotesOverviewProps) {
  const [entries, setEntries] = useState<AdminOverviewEntry[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    adminScoringApi.getOverview(eventId).then(setEntries);
  }, [eventId]);

  // "Baixar todas" — busca o detalhe completo de cada apresentação (a
  // listagem não traz grupos/critérios, só o resumo) e empacota um PDF
  // por apresentação num único .zip (decisão do usuário: zip com PDFs
  // separados, não um PDF gigante). Desistências saem — não têm súmula
  // de verdade (nunca chegam a ter nota), mesmo filtro que a lista já
  // aplica visualmente (chevron/nota escondidos pra elas).
  async function handleDownloadAll() {
    if (!entries) return;
    const scoredEntries = entries.filter((e) => !e.withdrawn);
    if (scoredEntries.length === 0) return;
    setDownloadingAll(true);
    try {
      const details = await Promise.all(
        scoredEntries.map((entry) => adminScoringApi.getDetail(eventId, entry.scheduleEntryId)),
      );
      await downloadPresentationDetailsAsZip(details, `sumulas-${slugify(eventName)}.zip`);
    } catch (err) {
      console.error("Não foi possível gerar as súmulas.", err);
    } finally {
      setDownloadingAll(false);
    }
  }

  if (selectedId) {
    return (
      <AdminPresentationDetailPanel
        eventId={eventId}
        scheduleEntryId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  const scoredCount = entries?.filter((e) => !e.withdrawn).length ?? 0;

  return (
    <div>
      <ReleaseFlagsPanel eventId={eventId} />
      {!entries ? (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Súmulas ({scoredCount})</p>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => void handleDownloadAll()}
              disabled={downloadingAll || scoredCount === 0}
              aria-label="Baixar todas as súmulas em PDF"
              title="Baixar todas as súmulas em PDF"
            >
              {downloadingAll ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            </Button>
          </div>
          <AdminNotesOverviewList entries={entries} onSelect={setSelectedId} />
        </>
      )}
    </div>
  );
}

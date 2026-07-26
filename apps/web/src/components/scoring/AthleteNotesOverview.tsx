import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { AdminNotesOverviewList } from "@/components/scoring/AdminNotesOverviewList";
import { AthletePresentationDetailPanel } from "@/components/scoring/AthletePresentationDetailPanel";
import { athleteScoringApi, type AdminOverviewEntry } from "@/api/client";

// Visão do Atleta na tela de Notas — mesma lista/detalhe somente-leitura
// do admin/assessor (AdminNotesOverview), mas filtrada aos programas
// com vínculo CONFIRMADO. Enquanto não houver nenhum vínculo confirmado
// que participe deste evento (ou as notas ainda não tiverem sido
// liberadas), a rota continua acessível mas mostra um aviso de
// bloqueio em vez da lista — ver ScoringService.getAthleteOverview.
interface AthleteNotesOverviewProps {
  eventId: string;
}

export function AthleteNotesOverview({ eventId }: AthleteNotesOverviewProps) {
  const [entries, setEntries] = useState<AdminOverviewEntry[] | null>(null);
  const [locked, setLocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    athleteScoringApi.getOverview(eventId).then((res) => {
      setEntries(res.entries);
      setLocked(res.locked);
    });
  }, [eventId]);

  if (selectedId) {
    return (
      <AthletePresentationDetailPanel
        eventId={eventId}
        scheduleEntryId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  if (entries === null) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (locked) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <Lock className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium text-foreground">Notas ainda bloqueadas</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Assim que o seu programa confirmar o vínculo (e o produtor liberar as notas do evento),
          as apresentações da sua equipe aparecem aqui.
        </p>
      </div>
    );
  }

  return <AdminNotesOverviewList entries={entries} onSelect={setSelectedId} />;
}

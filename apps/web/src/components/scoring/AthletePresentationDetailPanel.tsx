import { useEffect, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { PresentationNotesDetail } from "@/components/scoring/PresentationNotesDetail";
import { athleteScoringApi, type PresentationDetail } from "@/api/client";

// Mesmo espírito de AdminPresentationDetailPanel, só que buscando via
// athleteScoringApi (filtrado aos programas confirmados do atleta).
interface AthletePresentationDetailPanelProps {
  eventId: string;
  scheduleEntryId: string;
  onBack: () => void;
}

export function AthletePresentationDetailPanel({
  eventId,
  scheduleEntryId,
  onBack,
}: AthletePresentationDetailPanelProps) {
  const [detail, setDetail] = useState<PresentationDetail | null>(null);

  useEffect(() => {
    athleteScoringApi.getDetail(eventId, scheduleEntryId).then(setDetail);
  }, [eventId, scheduleEntryId]);

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar
      </button>

      {!detail ? (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <PresentationNotesDetail detail={detail} celebrateHitZero />
      )}
    </div>
  );
}

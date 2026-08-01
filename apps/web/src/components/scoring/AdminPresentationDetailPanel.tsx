import { useEffect, useState } from "react";
import { ChevronLeft, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PresentationNotesDetail } from "@/components/scoring/PresentationNotesDetail";
import { downloadPresentationDetailPdf } from "@/lib/presentationDetailExport";
import { adminScoringApi, type PresentationDetail } from "@/api/client";

// Detalhe somente-leitura, na visão do admin/assessor — os toggles de
// liberação (notas/contestação/resultado) saíram daqui e viraram ação
// global do evento (ver ReleaseFlagsPanel, no topo de
// AdminNotesOverview), não fazia mais sentido repeti-los apresentação
// por apresentação.
interface AdminPresentationDetailPanelProps {
  eventId: string;
  scheduleEntryId: string;
  onBack: () => void;
}

export function AdminPresentationDetailPanel({
  eventId,
  scheduleEntryId,
  onBack,
}: AdminPresentationDetailPanelProps) {
  const [detail, setDetail] = useState<PresentationDetail | null>(null);

  useEffect(() => {
    adminScoringApi.getDetail(eventId, scheduleEntryId).then(setDetail);
  }, [eventId, scheduleEntryId]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Voltar
        </button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => detail && downloadPresentationDetailPdf(detail)}
          disabled={!detail}
          aria-label="Baixar súmula em PDF"
          title="Baixar súmula em PDF"
        >
          <Download className="size-4" />
        </Button>
      </div>

      {!detail ? (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <PresentationNotesDetail detail={detail} />
      )}
    </div>
  );
}

import { lazy, Suspense, useState } from "react";
import { ExternalLink, Loader2, X, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { RegulationDocument } from "@/api/client";

// O visualizador de PDF (pdf.js + worker) fica em um chunk à parte: só
// baixa quando alguém realmente abre um PDF.
const PdfViewer = lazy(() => import("@/components/PdfViewer"));

const IMAGE_ZOOM_STEPS = [1, 1.5, 2, 3];

function ImageViewer({ url, name }: { url: string; name: string }) {
  const [zoomIndex, setZoomIndex] = useState(0);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto bg-muted/40 p-2">
        <img
          src={url}
          alt={name}
          className="mx-auto block h-auto max-w-none"
          style={{ width: `${IMAGE_ZOOM_STEPS[zoomIndex] * 100}%` }}
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/95 px-2 py-1 shadow-md backdrop-blur">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            aria-label="Diminuir zoom"
          >
            <ZoomOut />
          </Button>
          <span className="min-w-12 text-center text-xs font-medium tabular-nums text-foreground">
            {Math.round(IMAGE_ZOOM_STEPS[zoomIndex] * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setZoomIndex((i) => Math.min(IMAGE_ZOOM_STEPS.length - 1, i + 1))}
            disabled={zoomIndex === IMAGE_ZOOM_STEPS.length - 1}
            aria-label="Aumentar zoom"
          >
            <ZoomIn />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface DocumentViewerDialogProps {
  document: RegulationDocument | null;
  onOpenChange: (open: boolean) => void;
}

// Visualiza um documento do evento (PDF ou imagem) dentro do app, sem
// baixar nem abrir outra aba — tela cheia no celular, janela grande no
// desktop. "Abrir em outra aba" fica como saída se o carregamento falhar.
export function DocumentViewerDialog({ document, onOpenChange }: DocumentViewerDialogProps) {
  const isPdf = document?.mimeType === "application/pdf";
  const isImage = document?.mimeType.startsWith("image/") ?? false;

  return (
    <Dialog open={document !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 flex h-svh max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-[90svh] sm:w-[min(56rem,calc(100vw-2rem))] sm:max-w-none sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base font-semibold">
              {document?.name ?? "Documento"}
            </DialogTitle>
            <DialogDescription className="sr-only">Visualização do documento do evento</DialogDescription>
          </div>
          {document && (
            <a
              href={document.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir em outra aba"
              title="Abrir em outra aba"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
          >
            <X />
          </Button>
        </div>

        {document && isPdf && (
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Carregando visualizador...
              </div>
            }
          >
            <PdfViewer key={document.id} url={document.fileUrl} />
          </Suspense>
        )}
        {document && isImage && <ImageViewer key={document.id} url={document.fileUrl} name={document.name} />}
        {document && !isPdf && !isImage && (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Este tipo de arquivo não pode ser exibido aqui. Use "Abrir em outra aba".
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

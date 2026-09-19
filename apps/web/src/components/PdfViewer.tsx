import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";

// Build "legacy" do pdf.js (funciona em navegadores mais antigos, como
// iPhones sem atualização). Este módulo é carregado sob demanda
// (React.lazy em DocumentViewerDialog) — a biblioteca e o worker só
// baixam quando alguém abre um PDF.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const ZOOM_STEPS = [0.75, 1, 1.5, 2, 3];

interface PdfViewerProps {
  url: string;
  // Chamado quando não dá pra carregar (rede, CORS, arquivo inválido) —
  // o modal oferece "abrir em outra aba" como saída.
  onError?: () => void;
}

// Uma página, desenhada em <canvas> só quando chega perto da área
// visível (documentos grandes não estouram memória) e redesenhada
// quando a largura ou o zoom mudam.
function PdfPage({
  pdf,
  pageNumber,
  width,
  aspect,
  registerRef,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  aspect: number;
  registerRef: (pageNumber: number, el: HTMLDivElement | null) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [near, setNear] = useState(false);
  const [pageAspect, setPageAspect] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { rootMargin: "1200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near || width <= 0) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setPageAspect(base.height / base.width);
      // Limite de 2x na densidade de pixels: nítido sem pesar a memória.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (width / base.width) * dpr });
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${viewport.height / dpr}px`;
      renderTask = page.render({ canvasContext: ctx, viewport, canvas });
      try {
        await renderTask.promise;
      } catch {
        // renderização cancelada (zoom/rolagem) — esperado
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [near, pdf, pageNumber, width]);

  return (
    <div
      ref={(el) => {
        wrapperRef.current = el;
        registerRef(pageNumber, el);
      }}
      className="mx-auto shrink-0 bg-white shadow-sm ring-1 ring-black/10"
      style={{ width, height: width * (pageAspect ?? aspect) }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}

export default function PdfViewer({ url, onError }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [aspect, setAspect] = useState(1.414);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Sem range/stream: um GET simples, que funciona com CORS básico
    // (sem exigir cabeçalhos extras do CDN) — os PDFs têm até 10 MB.
    const task = pdfjsLib.getDocument({ url, disableRange: true, disableStream: true });
    task.promise
      .then(async (doc) => {
        if (cancelled) return;
        const first = await doc.getPage(1);
        const viewport = first.getViewport({ scale: 1 });
        if (cancelled) return;
        setAspect(viewport.height / viewport.width);
        setPdf(doc);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        onError?.();
      });
    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [url, onError]);

  // Largura útil da área de rolagem (as páginas se ajustam a ela).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(Math.max(0, el.clientWidth - 16));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pdf]);

  const registerRef = useCallback((pageNumber: number, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(pageNumber, el);
    else pageRefs.current.delete(pageNumber);
  }, []);

  // Página atual = a primeira cujo fim ainda está abaixo do topo.
  function handleScroll() {
    const container = containerRef.current;
    if (!container) return;
    const top = container.getBoundingClientRect().top + 40;
    let current = 1;
    for (const [number, el] of [...pageRefs.current.entries()].sort((a, b) => a[0] - b[0])) {
      if (el.getBoundingClientRect().bottom > top) {
        current = number;
        break;
      }
    }
    setCurrentPage(current);
  }

  if (failed) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Não foi possível carregar este documento aqui.
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Carregando documento...
      </div>
    );
  }

  const zoom = ZOOM_STEPS[zoomIndex];
  const pageWidth = containerWidth * zoom;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto bg-muted/40 p-2"
      >
        {Array.from({ length: pdf.numPages }, (_, i) => (
          <PdfPage
            key={i + 1}
            pdf={pdf}
            pageNumber={i + 1}
            width={pageWidth}
            aspect={aspect}
            registerRef={registerRef}
          />
        ))}
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
          <span className="min-w-20 text-center text-xs font-medium tabular-nums text-foreground">
            Página {currentPage} de {pdf.numPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            aria-label="Aumentar zoom"
          >
            <ZoomIn />
          </Button>
        </div>
      </div>
    </div>
  );
}

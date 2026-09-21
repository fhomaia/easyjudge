import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  CheckCircle2,
  GripHorizontal,
  Loader2,
  Minus,
  X,
  XCircle,
} from "lucide-react";
import { useUploadsStore } from "@/store/uploads";
import { useBeforeUnloadWarning } from "@/lib/useBeforeUnloadWarning";
import { cn } from "@/lib/utils";

const MARGIN = 8;
// Deslocamento até o gesto contar como arraste (e não como clique).
const DRAG_THRESHOLD_PX = 4;

interface Position {
  right: number;
  bottom: number;
}

// Painel fixo com o andamento dos uploads, visível em qualquer tela
// (inclusive depois de sair da página que iniciou o envio). Também
// liga o aviso do navegador ao fechar/recarregar enquanto algo estiver
// sendo enviado.
//
// Pode cobrir botões da página, então dá pra minimizar (vira uma
// pastilha) e arrastar pra qualquer canto — tanto o painel (pela
// alça do topo) quanto a pastilha. A posição/estado ficam só em
// memória: não vale persistir, o painel some quando não há envio.
export function UploadStatusBanner() {
  const items = useUploadsStore((s) => s.items);
  const dismiss = useUploadsStore((s) => s.dismiss);

  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState<Position>({ right: 16, bottom: 16 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    startX: number;
    startY: number;
    startPos: Position;
    moved: boolean;
  } | null>(null);
  const justDragged = useRef(false);

  const uploadingCount = items.filter((i) => i.status === "uploading").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const hasItems = items.length > 0;

  useBeforeUnloadWarning(uploadingCount > 0);

  // Erro nunca pode ficar escondido na pastilha: é o único aviso de
  // que o arquivo NÃO chegou.
  useEffect(() => {
    if (errorCount > 0) setMinimized(false);
  }, [errorCount]);

  function clamp(p: Position): Position {
    const el = wrapperRef.current;
    const w = el?.offsetWidth ?? 0;
    const h = el?.offsetHeight ?? 0;
    return {
      right: Math.min(Math.max(p.right, MARGIN), Math.max(MARGIN, window.innerWidth - w - MARGIN)),
      bottom: Math.min(Math.max(p.bottom, MARGIN), Math.max(MARGIN, window.innerHeight - h - MARGIN)),
    };
  }

  // Mantém dentro da tela ao girar o celular/redimensionar e ao
  // trocar entre painel e pastilha (tamanhos diferentes).
  useEffect(() => {
    if (!hasItems) return;
    const fit = () => setPos((p) => clamp(p));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [hasItems, minimized]);

  function handlePointerDown(e: PointerEvent<HTMLElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPos: pos,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD_PX) d.moved = true;
    if (d.moved) {
      // right/bottom crescem pro lado oposto ao movimento do ponteiro.
      setPos(clamp({ right: d.startPos.right - dx, bottom: d.startPos.bottom - dy }));
    }
  }

  function handlePointerUp() {
    if (drag.current?.moved) {
      // O `click` da pastilha dispara logo depois do pointerup; sem
      // isso, soltar depois de arrastar também expandiria o painel.
      justDragged.current = true;
      setTimeout(() => {
        justDragged.current = false;
      }, 100);
    }
    drag.current = null;
  }

  if (!hasItems) return null;

  const dragHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
  };

  return (
    <div
      ref={wrapperRef}
      aria-live="polite"
      style={{ right: pos.right, bottom: pos.bottom }}
      className="fixed z-[70]"
    >
      {minimized ? (
        <button
          type="button"
          {...dragHandlers}
          onClick={() => {
            if (!justDragged.current) setMinimized(false);
          }}
          aria-label="Expandir andamento dos envios"
          className={cn(
            "flex cursor-grab touch-none items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-lg active:cursor-grabbing",
            errorCount > 0
              ? "border-destructive/60"
              : uploadingCount > 0
                ? "border-primary/50"
                : "border-emerald-500/50",
          )}
        >
          {uploadingCount > 0 ? (
            <>
              <Loader2 className="size-4 animate-spin text-primary" />
              Enviando{items.length > 1 ? ` (${uploadingCount})` : ""}
            </>
          ) : errorCount > 0 ? (
            <>
              <XCircle className="size-4 text-destructive" />
              Falha no envio
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4 text-emerald-600" />
              Enviado
            </>
          )}
        </button>
      ) : (
        <div className="w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-lg border border-border/60 bg-card shadow-lg">
          {/* Alça: arrastar por aqui move o painel todo. */}
          <div
            {...dragHandlers}
            className="flex cursor-grab touch-none items-center justify-between gap-2 border-b border-border/60 bg-muted/50 px-3 py-1.5 active:cursor-grabbing"
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <GripHorizontal className="size-3.5" />
              Envios
            </span>
            <button
              type="button"
              // Sem isso o pointerdown do botão iniciaria um arraste.
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setMinimized(true)}
              aria-label="Minimizar"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Minus className="size-3.5" />
            </button>
          </div>

          <div className="flex flex-col divide-y divide-border/60">
            {items.map((item) => (
              <div
                key={item.id}
                role={item.status === "error" ? "alert" : "status"}
                className="flex items-start gap-3 p-3 text-sm"
              >
                {item.status === "uploading" && (
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
                )}
                {item.status === "done" && (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                )}
                {item.status === "error" && (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {item.status === "uploading" && "Enviando documento..."}
                    {item.status === "done" && "Documento enviado"}
                    {item.status === "error" && "Não foi possível enviar o documento"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{item.label}</p>
                  {item.status === "uploading" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pode continuar navegando. Não feche nem recarregue a página.
                    </p>
                  )}
                  {item.status === "error" && item.message && (
                    <p className="mt-1 text-xs text-destructive">{item.message}</p>
                  )}
                </div>
                {item.status !== "uploading" && (
                  <button
                    type="button"
                    onClick={() => dismiss(item.id)}
                    aria-label="Dispensar aviso"
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

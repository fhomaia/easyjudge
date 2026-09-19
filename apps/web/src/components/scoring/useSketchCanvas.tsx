import { useEffect, useRef, useState, type ReactNode } from "react";
import { Circle, Eraser, Minus, Pencil, Redo2, Square, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tool = "pen" | "eraser" | "line" | "rect" | "circle";

interface FreehandShape {
  tool: "pen" | "eraser";
  color: string;
  points: Array<{ x: number; y: number }>;
}

interface GeometricShape {
  tool: "line" | "rect" | "circle";
  color: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

type Shape = FreehandShape | GeometricShape;

function isFreehand(shape: Shape): shape is FreehandShape {
  return shape.tool === "pen" || shape.tool === "eraser";
}

const COLORS = ["#111827", "#2563eb", "#dc2626"];
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const SAVE_DEBOUNCE_MS = 900;

interface UseSketchCanvasProps {
  initialDataUrl: string | null;
  onChange: (dataUrl: string) => void;
  // Desenho vs. Caixa de texto (ver RascunhoEditor) precisam ocupar a
  // MESMA altura, senão o card do rascunho "pula" de tamanho ao trocar
  // de modo (pedido do usuário, 2026-09-19). Com isso true, o canvas
  // estica pra preencher a altura do container (mesma regra que a
  // caixa de texto já seguia via flex-1), em vez de calcular a própria
  // altura pela proporção 2:1 da resolução interna — só usado no
  // desktop, onde um ancestral já define uma altura fixa pra esticar;
  // sem isso (default, usado no mobile/demais contextos, sem altura
  // fixa no ancestral), a proporção 2:1 é o que evita o canvas colapsar
  // pra altura zero.
  stretchToFill?: boolean;
}

interface UseSketchCanvasResult {
  // Separados (em vez de um componente `<SketchCanvas>` só) pra
  // `RascunhoEditor` poder colocar a barra de ferramentas na MESMA
  // linha do toggle desenho/texto, em vez da linha própria que ela
  // ocupava antes — pedido do usuário, 2026-09-19 ("ganhamos uma linha
  // de espaço na tela"). Os dois compartilham o mesmo estado (formas,
  // ferramenta/cor atual) através deste hook, só a posição na árvore
  // de JSX é decidida por quem chama.
  toolbar: ReactNode;
  canvas: ReactNode;
}

// Canvas puro (sem lib de desenho) — pilha de formas em estado React
// pra desfazer/refazer (redesenha do zero a cada undo/redo), salva
// como PNG (`toDataURL`) com debounce depois que o traço assenta. A
// imagem inicial (`initialDataUrl`, se houver — reaberto de uma
// sessão anterior) vira uma camada de base fixa; undo/redo só afeta
// os traços feitos NESTA sessão, não volta atrás da base.
export function useSketchCanvas({
  initialDataUrl,
  onChange,
  stretchToFill = false,
}: UseSketchCanvasProps): UseSketchCanvasResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Último PNG capturado (ver scheduleSave) — o valor de verdade que o
  // debounce (ou o cleanup de desmontagem) envia pra `onChange`.
  const lastDataUrlRef = useRef<string | null>(null);
  // Sempre a versão mais recente de `onChange` — a flush de desmontagem
  // (ver useEffect abaixo) roda numa closure registrada só uma vez (no
  // mount), então sem isso ela chamaria uma versão desatualizada da
  // prop se o componente pai tivesse re-renderizado com uma nova
  // função entre o mount e o unmount.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [redoStack, setRedoStack] = useState<Shape[]>([]);
  const [drawing, setDrawing] = useState<Shape | null>(null);

  // Carrega a imagem-base (esboço salvo anteriormente), se houver.
  useEffect(() => {
    if (!initialDataUrl) return;
    const img = new Image();
    img.onload = () => {
      baseImageRef.current = img;
      redraw();
    };
    img.src = initialDataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDataUrl]);

  function redraw(overlay?: Shape) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (baseImageRef.current) ctx.drawImage(baseImageRef.current, 0, 0, canvas.width, canvas.height);
    for (const shape of shapes) drawShape(ctx, shape);
    if (overlay) drawShape(ctx, overlay);
  }

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes]);

  function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
    ctx.strokeStyle = shape.tool === "eraser" ? "#ffffff" : shape.color;
    ctx.lineWidth = shape.tool === "eraser" ? 22 : 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (shape.tool === "pen" || shape.tool === "eraser") {
      if (shape.points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      for (const p of shape.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      return;
    }
    if (shape.tool === "line") {
      ctx.beginPath();
      ctx.moveTo(shape.from.x, shape.from.y);
      ctx.lineTo(shape.to.x, shape.to.y);
      ctx.stroke();
      return;
    }
    if (shape.tool === "rect") {
      ctx.strokeRect(
        Math.min(shape.from.x, shape.to.x),
        Math.min(shape.from.y, shape.to.y),
        Math.abs(shape.to.x - shape.from.x),
        Math.abs(shape.to.y - shape.from.y),
      );
      return;
    }
    if (shape.tool === "circle") {
      const radius = Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y);
      ctx.beginPath();
      ctx.arc(shape.from.x, shape.from.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  }

  // Captura o PNG na hora (síncrono, com o canvas garantidamente vivo)
  // e só AGENDA quando `onChange` de fato roda — sem isso, o cleanup de
  // desmontagem (ver useEffect abaixo) não tinha como recuperar o
  // desenho: `canvasRef.current` já vem `null` nesse momento (React
  // desfaz a ref do <canvas> ANTES do cleanup do efeito rodar, não
  // depois — descoberto testando esta correção, contrariando a
  // suposição inicial). Reler o canvas ali sempre falhava em silêncio.
  function scheduleSave() {
    const canvas = canvasRef.current;
    if (canvas) lastDataUrlRef.current = canvas.toDataURL("image/png");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      if (lastDataUrlRef.current !== null) onChangeRef.current(lastDataUrlRef.current);
    }, SAVE_DEBOUNCE_MS);
  }

  // Desmontar (trocar de aba, no toggle desenho/texto do rascunho, ou
  // sair da tela) com um save ainda pendente no debounce descartava
  // esse traço em silêncio pra sempre (bug real, 2026-09-19: jurado
  // desenhava e trocava de aba rápido demais) — usa o PNG já capturado
  // em `lastDataUrlRef` (ver scheduleSave), não tenta reler o canvas.
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        if (lastDataUrlRef.current !== null) onChangeRef.current(lastDataUrlRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const point = pointFromEvent(e);
    setRedoStack([]);
    if (tool === "pen" || tool === "eraser") {
      setDrawing({ tool, color, points: [point] });
    } else {
      setDrawing({ tool, color, from: point, to: point });
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const point = pointFromEvent(e);
    const next: Shape = isFreehand(drawing)
      ? { tool: drawing.tool, color: drawing.color, points: [...drawing.points, point] }
      : { tool: drawing.tool, color: drawing.color, from: drawing.from, to: point };
    setDrawing(next);
    redraw(next);
  }

  function handlePointerUp() {
    if (!drawing) return;
    setShapes((prev) => [...prev, drawing]);
    setDrawing(null);
    scheduleSave();
  }

  function handleUndo() {
    if (shapes.length === 0) return;
    const last = shapes[shapes.length - 1];
    setShapes((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, last]);
    scheduleSave();
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setShapes((prev) => [...prev, last]);
    scheduleSave();
  }

  function handleClear() {
    setShapes([]);
    setRedoStack([]);
    baseImageRef.current = null;
    scheduleSave();
  }

  const TOOL_BUTTONS: Array<{ tool: Tool; icon: typeof Pencil; label: string }> = [
    { tool: "pen", icon: Pencil, label: "Caneta" },
    { tool: "eraser", icon: Eraser, label: "Borracha" },
    { tool: "line", icon: Minus, label: "Linha" },
    { tool: "rect", icon: Square, label: "Retângulo" },
    { tool: "circle", icon: Circle, label: "Círculo" },
  ];

  const toolbar = (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={handleUndo}
        disabled={shapes.length === 0}
        aria-label="Desfazer"
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
      >
        <Undo2 className="size-4" />
      </button>
      <button
        type="button"
        onClick={handleRedo}
        disabled={redoStack.length === 0}
        aria-label="Refazer"
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
      >
        <Redo2 className="size-4" />
      </button>
      <div className="mx-1 h-5 w-px bg-border" />
      {TOOL_BUTTONS.map(({ tool: t, icon: Icon, label }) => (
        <button
          key={t}
          type="button"
          onClick={() => setTool(t)}
          aria-label={label}
          title={label}
          className={cn(
            "flex size-8 items-center justify-center rounded-md transition-colors",
            tool === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
      <div className="mx-1 h-5 w-px bg-border" />
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setColor(c)}
          aria-label={`Cor ${c}`}
          className={cn(
            "size-6 shrink-0 rounded-full ring-offset-2",
            color === c && "ring-2 ring-foreground",
          )}
          style={{ backgroundColor: c }}
        />
      ))}
      <button
        type="button"
        onClick={handleClear}
        aria-label="Limpar esboço"
        title="Limpar esboço"
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );

  const canvas = (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={cn(
        "w-full flex-1 touch-none rounded-lg border border-border bg-white",
        stretchToFill && "min-h-0",
      )}
      style={stretchToFill ? undefined : { aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
    />
  );

  return { toolbar, canvas };
}

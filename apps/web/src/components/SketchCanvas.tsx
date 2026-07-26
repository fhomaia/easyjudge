import { useEffect, useRef, useState } from "react";
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

interface SketchCanvasProps {
  initialDataUrl: string | null;
  onChange: (dataUrl: string) => void;
}

// Canvas puro (sem lib de desenho) — pilha de formas em estado React
// pra desfazer/refazer (redesenha do zero a cada undo/redo), salva
// como PNG (`toDataURL`) com debounce depois que o traço assenta. A
// imagem inicial (`initialDataUrl`, se houver — reaberto de uma
// sessão anterior) vira uma camada de base fixa; undo/redo só afeta
// os traços feitos NESTA sessão, não volta atrás da base.
export function SketchCanvas({ initialDataUrl, onChange }: SketchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function scheduleSave() {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) onChange(canvas.toDataURL("image/png"));
    }, SAVE_DEBOUNCE_MS);
  }

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

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
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
          className="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="mt-2 w-full flex-1 touch-none rounded-lg border border-border bg-white"
        style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
      />
    </div>
  );
}

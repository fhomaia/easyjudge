import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSketchCanvas } from "@/components/scoring/useSketchCanvas";

type RascunhoMode = "draw" | "text";

function ModeButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
        selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

interface RascunhoEditorProps {
  // Desenho e texto são campos SEPARADOS no backend (SKETCH_SET e
  // SKETCH_TEXT_SET) — cada um preserva o próprio conteúdo ao trocar
  // de modo, nenhum apaga o outro (pedido do usuário, 2026-09-19: os
  // dois dividiam o mesmo campo antes, e alternar entre eles apagava
  // o que já estava no outro modo).
  drawValue: string | null;
  onDrawChange: (value: string) => void;
  textValue: string | null;
  onTextChange: (value: string) => void;
  // "desktop" faz o desenho ESTICAR pra preencher a altura do card (ver
  // EventLiveScoringDesktopView) em vez de calcular a própria altura
  // pela proporção do canvas — sem isso, "Desenho livre" ficava mais
  // alto que "Caixa de texto" (pedido do usuário, 2026-09-19). No
  // mobile não há altura fixa de ancestral pra esticar, então o padrão
  // continua sendo a proporção própria do canvas.
  variant?: "mobile" | "desktop";
}

export function RascunhoEditor({
  drawValue,
  onDrawChange,
  textValue,
  onTextChange,
  variant = "mobile",
}: RascunhoEditorProps) {
  // Reabrir uma folha com só um dos dois preenchido já entra nesse
  // modo; com os dois vazios (rascunho novo) ou os dois preenchidos
  // (editado nas duas formas em sessões diferentes), começa em desenho.
  const [mode, setMode] = useState<RascunhoMode>(() => (!drawValue && textValue ? "text" : "draw"));
  const { toolbar, canvas } = useSketchCanvas({
    initialDataUrl: drawValue,
    onChange: onDrawChange,
    stretchToFill: variant === "desktop",
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Toggle e barra de ferramentas do desenho na MESMA linha (pedido
          do usuário, 2026-09-19: "ganhamos uma linha de espaço na
          tela") — a barra só existe (`mode === "draw"`) quando há
          ferramenta pra mostrar, então o modo texto não sobra com um
          espaço vazio no lugar dela. Isso também é o que faz as duas
          alturas finalmente baterem: antes a barra de ferramentas do
          canvas vinha numa linha própria, exclusiva do modo desenho. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex shrink-0 gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
          <ModeButton selected={mode === "draw"} onClick={() => setMode("draw")}>
            Desenho livre
          </ModeButton>
          <ModeButton selected={mode === "text"} onClick={() => setMode("text")}>
            Caixa de texto
          </ModeButton>
        </div>
        {mode === "draw" && toolbar}
      </div>
      {mode === "draw" ? (
        canvas
      ) : (
        <textarea
          value={textValue ?? ""}
          onChange={(e) => onTextChange(e.target.value.slice(0, 1000))}
          placeholder="Digite seu rascunho aqui..."
          className="min-h-[160px] w-full flex-1 resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus-visible:border-primary"
        />
      )}
    </div>
  );
}

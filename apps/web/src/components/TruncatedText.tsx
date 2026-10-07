import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// Texto cortado com reticências (ex.: email longo); passar o mouse ou
// tocar mostra uma etiqueta com o texto completo. O toque não propaga
// (dentro de um <label>, não marca a caixa). A etiqueta vai num portal com
// posição fixa: dentro de uma lista com rolagem própria (popups), ela era
// cortada e fazia a lista rolar.
export function TruncatedText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  function show() {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.left });
  }

  // Rolar qualquer coisa fecha a etiqueta (a posição deixaria de bater).
  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [position]);

  return (
    <span
      ref={ref}
      className="block min-w-0"
      onMouseEnter={show}
      onMouseLeave={() => setPosition(null)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (position) setPosition(null);
        else show();
      }}
    >
      <span className={cn("block truncate", className)}>{text}</span>
      {position &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: position.top, left: position.left }}
            className="pointer-events-none fixed z-[100] max-w-64 rounded-md bg-foreground px-2 py-1 text-xs break-all text-background shadow-md"
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}

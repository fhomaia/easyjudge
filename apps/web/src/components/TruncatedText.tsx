import { useState } from "react";
import { cn } from "@/lib/utils";

// Texto cortado com reticências (ex.: email longo); passar o mouse ou
// tocar mostra uma etiqueta com o texto completo. O toque não propaga
// (dentro de um <label>, não marca a caixa).
export function TruncatedText({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative block min-w-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen((o) => !o);
      }}
    >
      <span className={cn("block truncate", className)}>{text}</span>
      {open && (
        <span
          role="tooltip"
          className="absolute top-full left-0 z-10 mt-1 max-w-64 rounded-md bg-foreground px-2 py-1 text-xs break-all text-background shadow-md"
        >
          {text}
        </span>
      )}
    </span>
  );
}

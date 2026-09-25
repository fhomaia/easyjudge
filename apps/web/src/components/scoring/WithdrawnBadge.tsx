import { XCircle } from "lucide-react";

// Selo "Desistência" no cabeçalho da súmula (mesmo visual do Cronograma).
export function WithdrawnBadge() {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">
      <XCircle className="size-3.5" />
      Desistência
    </span>
  );
}

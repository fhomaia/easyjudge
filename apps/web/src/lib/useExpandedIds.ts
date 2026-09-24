import { useCallback, useState } from "react";

// Linhas de lista que abrem no toque pra mostrar o texto inteiro (nome
// de equipe/categoria costuma ser grande e fica cortado no celular).
// Cada linha abre e fecha sozinha, sem fechar as outras.
export function useExpandedIds() {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isExpanded = useCallback((id: string) => expanded.has(id), [expanded]);

  return { isExpanded, toggle };
}

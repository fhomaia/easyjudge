import { useEffect, useRef, useState } from "react";

const DEFAULT_MIN_MS = 500;
// Trava de segurança: se algum carregamento nunca terminar (requisição
// que falha sem limpar o estado), o indicador some sozinho em vez de
// cobrir a tela pra sempre.
const MAX_MS = 10_000;

// Devolve `true` enquanto `isLoading` for true E por, no mínimo, `minMs`
// desde o início do carregamento — evita o raio "piscar" quando a
// resposta chega rápido demais pra ser percebida.
export function useMinimumLoading(isLoading: boolean, minMs = DEFAULT_MIN_MS): boolean {
  const [visible, setVisible] = useState(isLoading);
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef<number | null>(isLoading ? Date.now() : null);

  useEffect(() => {
    if (isLoading) {
      if (startedAt.current === null) startedAt.current = Date.now();
      setVisible(true);
      const cap = setTimeout(() => setTimedOut(true), MAX_MS);
      return () => clearTimeout(cap);
    }
    setTimedOut(false);
    if (startedAt.current === null) {
      setVisible(false);
      return;
    }
    const remaining = Math.max(0, startedAt.current + minMs - Date.now());
    const timer = setTimeout(() => {
      startedAt.current = null;
      setVisible(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [isLoading, minMs]);

  return !timedOut && (isLoading || visible);
}

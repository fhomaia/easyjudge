import { Zap } from "lucide-react";
import { useMinimumLoading } from "@/lib/useMinimumLoading";

// Raio girando enquanto os dados iniciais da página carregam (mínimo
// de meio segundo, ver useMinimumLoading). `absolute inset-0` — cobre
// só o `<main>` que o chama (precisa já ser `position: relative`, as
// telas com esse layout já são desde o fix do duplo scroll), não a
// barra lateral/topo mobile. `fixed inset-0` (como o RouteLoadingFallback
// do Suspense/telas "ao vivo") borraria uma barra lateral JÁ renderizada
// e que nem precisa recarregar — reportado pelo usuário como uma
// transição esquisita (2026-09-21).
export function PageLoadingOverlay({ loading }: { loading: boolean }) {
  const show = useMinimumLoading(loading);
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-sm"
    >
      <Zap className="size-10 animate-spin fill-primary text-primary" />
      <span className="sr-only">Carregando...</span>
    </div>
  );
}

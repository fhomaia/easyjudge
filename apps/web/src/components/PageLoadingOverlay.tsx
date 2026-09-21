import { RouteLoadingFallback } from "@/components/RouteLoadingFallback";
import { useMinimumLoading } from "@/lib/useMinimumLoading";

// Raio girando por cima da tela enquanto os dados iniciais carregam
// (mínimo de meio segundo, ver useMinimumLoading). Fica SOBRE o layout
// da página — a barra lateral não some — diferente das telas "ao vivo",
// que devolvem só o raio enquanto não há dados.
export function PageLoadingOverlay({ loading }: { loading: boolean }) {
  const show = useMinimumLoading(loading);
  return show ? <RouteLoadingFallback /> : null;
}

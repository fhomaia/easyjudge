import { Zap } from "lucide-react";

export function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
    >
      <Zap className="size-10 animate-spin fill-primary text-primary" />
      <span className="sr-only">Carregando...</span>
    </div>
  );
}

import { cn } from "@/lib/utils";

// Bolinha pulsando de "ao vivo" (mesmo desenho do "Acontecendo agora"
// do Cronograma). `className` troca a cor.
export function LivePulseDot({ className = "bg-violet-500" }: { className?: string }) {
  return (
    <span className="relative flex size-1.5">
      <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", className)} />
      <span className={cn("relative inline-flex size-1.5 rounded-full", className)} />
    </span>
  );
}

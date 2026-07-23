import { cn } from "@/lib/utils";

export function BlinkingDot({ colorClassName }: { colorClassName: string }) {
  return (
    <span className="relative flex size-2">
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
          colorClassName,
        )}
      />
      <span className={cn("relative inline-flex size-2 rounded-full", colorClassName)} />
    </span>
  );
}

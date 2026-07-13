import { cn } from "@/lib/utils";

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "a", "o", "as", "os",
  "para", "com", "um", "uma", "no", "na", "nos", "nas",
]);

function getEventInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const significant = words.filter((w) => !STOPWORDS.has(w.toLowerCase()));
  const source = significant.length > 0 ? significant : words;
  return source
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

interface EventThumbnailProps {
  name: string;
  logoUrl: string | null;
  className?: string;
}

export function EventThumbnail({ name, logoUrl, className }: EventThumbnailProps) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={cn("size-12 shrink-0 rounded-lg object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary",
        className,
      )}
    >
      {getEventInitials(name)}
    </div>
  );
}

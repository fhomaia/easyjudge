import { cn } from "@/lib/utils";
import { getAvatarColor } from "@/lib/avatarColor";

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
      style={{ backgroundColor: getAvatarColor(name) }}
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white",
        className,
      )}
    >
      {getEventInitials(name)}
    </div>
  );
}

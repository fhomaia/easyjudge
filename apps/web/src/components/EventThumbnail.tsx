import { cn } from "@/lib/utils";
import { getAvatarColor } from "@/lib/avatarColor";

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "a", "o", "as", "os",
  "para", "com", "um", "uma", "no", "na", "nos", "nas",
]);

function getEventInitials(name: string): string {
  // Separa em qualquer coisa que não seja letra ou número (espaço,
  // hífen, emoji, "#", etc.), pra símbolos nunca virarem sigla. \p{L}
  // cobre acentuadas (Águia -> Á), não só A-Z.
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const significant = words.filter((w) => !STOPWORDS.has(w.toLowerCase()));
  const source = significant.length > 0 ? significant : words;
  const initials = source
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  // Nome sem nenhuma letra/número (ex. só símbolos): evita o quadrado vazio.
  return initials || "?";
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

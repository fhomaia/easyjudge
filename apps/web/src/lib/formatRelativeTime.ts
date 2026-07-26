import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatRelativeTime(isoDate: string): string {
  return formatDistanceToNow(new Date(isoDate), { addSuffix: true, locale: ptBR });
}

import { cn } from "@/lib/utils";
import { useNotificationsUnreadStore } from "@/store/notificationsUnread";

// Não lidas do evento: bolinha com o número no canto da foto do card
// (mesmo visual do sino e do menu). O pai precisa ser `relative`.
export function EventUnreadBadge({
  aliasId,
  className,
}: {
  aliasId: string;
  // Ex.: outra cor quando fica sobre um botão azul.
  className?: string;
}) {
  const count = useNotificationsUnreadStore((s) => s.byEvent[aliasId] ?? 0);
  if (count <= 0) return null;
  return (
    <span
      title={count === 1 ? "1 notificação não lida" : `${count} notificações não lidas`}
      className={cn(
        "absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground ring-2 ring-card",
        className,
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

import { Bell } from "lucide-react";

interface NotificationBellProps {
  // Contagem de não lidas do evento em foco na tela — undefined nas
  // telas sem um evento específico em contexto (Home, biblioteca de
  // sistemas de pontuação, que não são presas a um evento só), onde
  // não faz sentido nenhum indicador. Sem badge quando 0/undefined.
  unreadCount?: number;
}

export function NotificationBell({ unreadCount }: NotificationBellProps) {
  return (
    <div className="relative text-muted-foreground" title="Notificações">
      <Bell className="size-5" />
      {!!unreadCount && (
        <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground ring-2 ring-background">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </div>
  );
}

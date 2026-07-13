import { Bell } from "lucide-react";

export function NotificationBell() {
  return (
    <div className="relative text-muted-foreground" title="Notificações">
      <Bell className="size-5" />
      <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-background" />
    </div>
  );
}

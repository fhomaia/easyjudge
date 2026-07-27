import {
  CalendarCheck,
  ClipboardList,
  Flag,
  Gavel,
  Hourglass,
  Play,
  Trophy,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { NotificationType, NotificationView } from "@/api/client";

// Ícone por tipo — cor é sempre a mesma (azul, ver EventLiveShared/
// NotificationsPage), só o ícone muda pra dar contexto rápido sem
// precisar de uma paleta por tipo (o pedido do usuário foi justamente
// "menos alarmante", uma cor só ajuda nisso).
export const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  presentation_started: Play,
  presentation_completed: CalendarCheck,
  scores_released: ClipboardList,
  results_released: Trophy,
  contestation_released: Flag,
  evaluation_pending: Hourglass,
  contestation_requested: Gavel,
  presentation_cancelled: XCircle,
};

export { formatRelativeTime as formatNotificationRelativeTime } from "@/lib/formatRelativeTime";

// Pra onde o clique numa notificação leva — sempre a tela onde a ação
// relacionada acontece (súmula, notas, resultado). `null` = sem destino
// (não deveria acontecer com os tipos de hoje, mas alguns tipos futuros
// podem não ter um destino natural).
export function notificationHref(eventId: string, notification: NotificationView): string | null {
  switch (notification.type) {
    case "scores_released":
      return `/events/${eventId}/live/notes`;
    case "results_released":
    case "contestation_released":
      return `/events/${eventId}/live/results`;
    case "presentation_started":
    case "presentation_completed":
    case "evaluation_pending":
    case "contestation_requested":
      return notification.scheduleEntryId
        ? `/events/${eventId}/live/scoring/${notification.scheduleEntryId}`
        : null;
    // Apresentação cancelada não pode mais ser pontuada — leva pro
    // cronograma (onde a desistência fica marcada), não pra súmula.
    case "presentation_cancelled":
      return `/events/${eventId}/live/schedule`;
    default:
      return null;
  }
}

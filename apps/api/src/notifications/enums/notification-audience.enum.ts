// ALL = qualquer EventMember do evento, independente de papel.
// STAFF = só admin/assessor/judge (ver NotificationsService.listForUser).
// MANAGERS = só admin/assessor (pedidos de inscrição, 2026-10-05).
export enum NotificationAudience {
  ALL = 'all',
  STAFF = 'staff',
  MANAGERS = 'managers',
}

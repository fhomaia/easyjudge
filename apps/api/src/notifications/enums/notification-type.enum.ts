// Extensível via migration ADD VALUE, mesmo padrão de ScoreEventKind.
export enum NotificationType {
  PRESENTATION_STARTED = 'presentation_started',
  PRESENTATION_COMPLETED = 'presentation_completed',
  SCORES_RELEASED = 'scores_released',
  RESULTS_RELEASED = 'results_released',
  CONTESTATION_RELEASED = 'contestation_released',
  EVALUATION_PENDING = 'evaluation_pending',
  CONTESTATION_REQUESTED = 'contestation_requested',
  // Disparada por ScoringService.withdrawPresentation (2026-07-26) —
  // fluxo de desistência.
  PRESENTATION_CANCELLED = 'presentation_cancelled',
  // Disparada por ScheduleService.moveEntry (2026-07-27) — só quando o
  // evento não está mais "created" (fase de construção do cronograma
  // não notifica ninguém, só a partir de publicado/ao vivo).
  PRESENTATION_MOVED = 'presentation_moved',
  SPECIAL_EVENT_STARTED = 'special_event_started',
  SPECIAL_EVENT_ENDED = 'special_event_ended',
  // Inscrição pelo programa (2026-10-05), audiência MANAGERS.
  REGISTRATION_SUBMITTED = 'registration_submitted',
  REGISTRATION_REQUEST = 'registration_request',
  // Pro programa (destinatário único): organizador liberou a ficha.
  REGISTRATION_REOPENED = 'registration_reopened',
  // Pro programa (destinatário único): produtor contestou um documento de
  // atleta (2026-10-06).
  DOCUMENT_CONTESTED = 'document_contested',
}

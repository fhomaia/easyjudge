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
}

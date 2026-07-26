// Gatilhos reais implementados (2026-07-26) — "[apresentação]
// cancelada"/desistência ficou de fora desta rodada por depender de uma
// funcionalidade que ainda não existe (confirmado com o usuário).
// Extensível via migration ADD VALUE, mesmo padrão de ScoreEventKind.
export enum NotificationType {
  PRESENTATION_STARTED = 'presentation_started',
  PRESENTATION_COMPLETED = 'presentation_completed',
  SCORES_RELEASED = 'scores_released',
  RESULTS_RELEASED = 'results_released',
  CONTESTATION_RELEASED = 'contestation_released',
  EVALUATION_PENDING = 'evaluation_pending',
  CONTESTATION_REQUESTED = 'contestation_requested',
}

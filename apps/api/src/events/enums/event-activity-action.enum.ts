// Ações de ciclo de vida do evento registradas em EventActivityLog —
// cada método de escrita relevante em EventsService grava uma linha.
export enum EventActivityAction {
  CREATED = 'created',
  UPDATED = 'updated',
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
  STARTED = 'started',
  COMPLETED = 'completed',
  DELETED = 'deleted',
  // Telas de cadastro do evento (2026-07-26, a pedido do usuário) —
  // escala de arbitragem (judging) e cronograma foram deliberadamente
  // deixados de fora (volume alto de eventos pequenos, pouco valor de
  // auditoria por entrada).
  CATEGORY_CREATED = 'category_created',
  CATEGORY_UPDATED = 'category_updated',
  CATEGORY_DELETED = 'category_deleted',
  PROGRAM_CREATED = 'program_created',
  PROGRAM_UPDATED = 'program_updated',
  PROGRAM_DELETED = 'program_deleted',
  TEAM_CREATED = 'team_created',
  TEAM_UPDATED = 'team_updated',
  TEAM_DELETED = 'team_deleted',
  REGULATION_DOCUMENT_UPLOADED = 'regulation_document_uploaded',
  REGULATION_DOCUMENT_REMOVED = 'regulation_document_removed',
  REGULATION_DEDUCTIONS_UPDATED = 'regulation_deductions_updated',
  STAFF_MEMBER_ADDED = 'staff_member_added',
  STAFF_MEMBER_UPDATED = 'staff_member_updated',
  STAFF_MEMBER_REMOVED = 'staff_member_removed',
  // Exceção à exclusão deliberada de cronograma acima (2026-07-27, a
  // pedido do usuário): só registrada quando o evento NÃO está mais
  // "created" (ScheduleService.moveEntry) — mover apresentação depois
  // de publicado/ao vivo já tem valor de auditoria real, diferente do
  // CRUD comum de construção do cronograma.
  PRESENTATION_MOVED = 'presentation_moved',
}

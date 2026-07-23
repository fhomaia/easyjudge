// Ações de ciclo de vida do evento registradas em EventActivityLog —
// cada método de escrita relevante em EventsService grava uma linha.
export enum EventActivityAction {
  CREATED = 'created',
  UPDATED = 'updated',
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
  STARTED = 'started',
  DELETED = 'deleted',
}

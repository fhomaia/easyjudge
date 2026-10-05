import { EventStatus } from './enums/event-status.enum';

// Inscrição pelo próprio programa (2026-10-05): aberta com o evento em
// rascunho ou publicado e até o fim (23:59 de Brasília) do dia
// `registrationDeadline`. Sem data = sem limite. Mesma regra em
// apps/web/src/lib/registrationWindow.ts.
const REGISTRATION_STATUSES = [EventStatus.CREATED, EventStatus.PUBLISHED];

export function todayInBrasilia(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(now);
}

export function isRegistrationOpen(event: {
  status: EventStatus;
  registrationDeadline: string | null;
}): boolean {
  if (!REGISTRATION_STATUSES.includes(event.status)) return false;
  return (
    event.registrationDeadline === null ||
    todayInBrasilia() <= event.registrationDeadline
  );
}

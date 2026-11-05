import { EventStatus } from './enums/event-status.enum';
import { RegistrationStatus } from './enums/registration-status.enum';

// Inscrição pelo próprio programa (2026-10-05): aberta com o evento em
// rascunho ou publicado, liberada pelo produtor (2026-10-11) e até o fim (23:59 de Brasília) do dia
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
  registrationStatus: RegistrationStatus;
}): boolean {
  if (!REGISTRATION_STATUSES.includes(event.status)) return false;
  if (event.registrationStatus !== RegistrationStatus.OPEN) return false;
  return (
    event.registrationDeadline === null ||
    todayInBrasilia() <= event.registrationDeadline
  );
}

// Mensagem de recusa quando a inscrição não está aberta.
export function registrationClosedMessage(event: {
  registrationStatus: RegistrationStatus;
}): string {
  if (event.registrationStatus === RegistrationStatus.PAUSED) {
    return 'As inscrições deste evento estão pausadas pelo organizador.';
  }
  if (event.registrationStatus === RegistrationStatus.NOT_STARTED) {
    return 'As inscrições deste evento ainda não foram liberadas.';
  }
  return 'As inscrições deste evento estão encerradas.';
}

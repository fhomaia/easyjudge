import { EventStatus } from '../events/enums/event-status.enum';
import { isRegistrationOpen } from '../events/registration-window';

const BEFORE_START = [EventStatus.CREATED, EventStatus.PUBLISHED];

type EditableEvent = { status: EventStatus; registrationDeadline: string | null };
type EditableParticipation = { submittedAt: Date | null; reopenedAt: Date | null };

// O programa pode mexer na própria ficha? (2026-10-05)
// - rascunho: enquanto as inscrições estiverem abertas;
// - enviada: não (só pedidos ao organizador), a menos que o organizador
//   tenha liberado a edição — aí até o evento iniciar.
export function programCanEditRegistration(
  event: EditableEvent,
  participation: EditableParticipation,
): boolean {
  if (!participation.submittedAt) return isRegistrationOpen(event);
  if (participation.reopenedAt) return BEFORE_START.includes(event.status);
  return false;
}

// Pedidos de alteração/cancelamento: ficha enviada, até o evento iniciar.
export function programCanRequestChange(
  event: EditableEvent,
  participation: EditableParticipation,
): boolean {
  return participation.submittedAt !== null && BEFORE_START.includes(event.status);
}

export const REGISTRATION_LOCKED_MESSAGE =
  'Sua inscrição já foi enviada. Para mudar algo, envie um pedido ao organizador.';

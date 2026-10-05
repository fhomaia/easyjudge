import type { EventStatus } from "@/api/client";

// Inscrição pelo próprio programa: aberta com o evento em rascunho ou
// publicado e até 23:59 (Brasília) do dia `registrationDeadline`; sem data
// = sem limite. Mesma regra de apps/api/src/events/registration-window.ts
// (a API é quem decide; isto só serve pra mostrar o botão).
export function todayInBrasilia(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export function isRegistrationOpen(event: {
  status: EventStatus;
  registrationDeadline: string | null;
}): boolean {
  if (event.status !== "created" && event.status !== "published") return false;
  return event.registrationDeadline === null || todayInBrasilia() <= event.registrationDeadline;
}

// "yyyy-MM-dd" -> "dd/mm/aaaa"
export function formatDeadline(date: string): string {
  return date.split("-").reverse().join("/");
}

// Conta Programa que entra num evento pelo link/QR/código com a inscrição
// aberta vai direto pra ela (fluxo mais curto); senão, null.
export function registrationPathAfterJoin(
  event: { aliasId: string; status: EventStatus; registrationDeadline: string | null },
  accountRole: string | null,
): string | null {
  return accountRole === "program" && isRegistrationOpen(event)
    ? `/events/${event.aliasId}/registration`
    : null;
}

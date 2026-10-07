import { ClipboardList } from "lucide-react";
import { formatDeadline } from "@/lib/registrationWindow";
import { cn } from "@/lib/utils";
import type { AthleteRegistrationEvent } from "@/api/client";

// Botão da inscrição como atleta no card do evento da Home (2026-10-07,
// substitui o bloco "Suas inscrições como atleta"). Completar dados e
// documentos é OPCIONAL pro atleta (o programa pode fazer tudo):
// "Inscreva-se aqui!" até o programa ou o atleta enviar; depois, "Minha
// inscrição". O número no canto é o que falta (vermelho com documento
// contestado).
export function AthleteRegistrationAction({
  registration,
  onOpen,
}: {
  registration: AthleteRegistrationEvent;
  onOpen: () => void;
}) {
  const pending = registration.entries.reduce((sum, e) => sum + e.pendingCount, 0);
  const contested = registration.entries.reduce((sum, e) => sum + e.contestedCount, 0);
  const submitted = registration.entries.every(
    (e) => e.requirements.programSubmitted || !!e.requirements.athleteSubmittedAt,
  );
  const programs = registration.entries.map((e) => e.programName).join(", ");
  const status =
    contested > 0
      ? contested === 1
        ? "1 documento contestado"
        : `${contested} documentos contestados`
      : pending > 0
        ? pending === 1
          ? "Falta 1 item"
          : `Faltam ${pending} itens`
        : submitted
          ? "Inscrição enviada"
          : null;
  const title = [
    `Inscrição como atleta (${programs})`,
    status,
    registration.open && registration.registrationDeadline
      ? `Até ${formatDeadline(registration.registrationDeadline)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const badge = contested > 0 ? contested : pending;

  return (
    <button
      type="button"
      onClick={onOpen}
      title={title}
      className={
        submitted
          ? "relative flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          : // Mesmo degradê do botão de inscrição do programa.
            "relative flex items-center gap-1.5 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 px-3 py-1 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
      }
    >
      <ClipboardList className="size-3.5" />
      {submitted ? "Minha inscrição" : "Inscreva-se aqui!"}
      {badge > 0 && (
        <span
          className={cn(
            "absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none text-white",
            contested > 0 ? "bg-destructive" : "bg-amber-500",
          )}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

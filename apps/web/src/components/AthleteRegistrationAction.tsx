import { ClipboardList } from "lucide-react";
import { formatDeadline } from "@/lib/registrationWindow";
import type { AthleteRegistrationEvent } from "@/api/client";

// Botão da inscrição como atleta no card do evento da Home (2026-10-07,
// substitui o bloco "Suas inscrições como atleta"). "Inscreva-se aqui!"
// enquanto nenhum pedido saiu do rascunho (2026-10-10: pedido de inscrição
// do atleta); depois, "Minha inscrição". O número no canto só aparece
// quando há algo a resolver: documento contestado ou correção pedida pelo
// programa. O que falta preencher fica no título (só dos programas em que
// o atleta já começou um pedido), não no número.
export function AthleteRegistrationAction({
  registration,
  onOpen,
}: {
  registration: AthleteRegistrationEvent;
  onOpen: () => void;
}) {
  // Mesmo critério de "Seus programas": pedido começado ou já inscrito.
  const started = registration.entries.filter((e) => !!e.request || e.categories.length > 0);
  const pending = started.reduce((sum, e) => sum + e.pendingCount, 0);
  const contested = started.reduce((sum, e) => sum + e.contestedCount, 0);
  // Algum pedido enviado (ou já inscrito pelo programa).
  const submitted = registration.entries.some(
    (e) =>
      e.categories.length > 0 ||
      e.request?.status === "submitted" ||
      e.request?.status === "approved",
  );
  const corrections = registration.entries.filter(
    (e) => e.request?.status === "changes_requested" && !e.request.expired,
  ).length;
  const programs = started.map((e) => e.programName).join(", ");
  const status =
    corrections > 0
      ? "O programa pediu uma correção"
      : contested > 0
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
    programs ? `Inscrição como atleta (${programs})` : "Inscrição como atleta",
    status,
    registration.open && registration.registrationDeadline
      ? `Até ${formatDeadline(registration.registrationDeadline)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const badge = contested + corrections;

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
        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

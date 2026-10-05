import type { ReactNode } from "react";
import type { RegistrationRequestType, RegistrationRequestView } from "@/api/client";

const REQUEST_TYPE_LABELS: Record<RegistrationRequestType, string> = {
  change: "Alteração",
  cancel: "Cancelamento",
};

// Pedido do programa ao organizador (ficha de inscrição e tela do
// programa no Setup).
export function RegistrationRequestItem({
  request,
  action,
}: {
  request: RegistrationRequestView;
  action?: ReactNode;
}) {
  return (
    <div className="grid gap-1 rounded-lg bg-card p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-foreground">{REQUEST_TYPE_LABELS[request.type]}</span>
        <span className="text-muted-foreground">
          {new Date(request.createdAt).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        {request.resolvedAt ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
            Resolvido
          </span>
        ) : (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400">
            Pendente
          </span>
        )}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {request.message ? (
        <p className="text-sm whitespace-pre-wrap text-foreground">{request.message}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">Sem justificativa.</p>
      )}
    </div>
  );
}


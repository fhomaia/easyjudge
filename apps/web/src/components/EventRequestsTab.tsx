import { useState } from "react";
import { Link } from "react-router-dom";
import { Unlock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RegistrationRequestItem } from "@/components/RegistrationRequestItem";
import {
  ApiError,
  programRegistrationAdminApi,
  type EventRegistrationRequestView,
} from "@/api/client";

// Aba "Solicitações" da tela de Programas e equipes (2026-10-05): pedidos
// de alteração/cancelamento de todos os programas que se inscreveram
// sozinhos, pendentes primeiro. Daqui o produtor marca como resolvido e
// libera a ficha pro programa editar ("Liberar edição").
export function EventRequestsTab({
  eventId,
  requests,
  programFilter,
  onClearFilter,
  onChanged,
}: {
  eventId: string;
  requests: EventRegistrationRequestView[];
  programFilter: string | null;
  onClearFilter: () => void;
  onChanged: () => void;
}) {
  const [reopenTarget, setReopenTarget] = useState<EventRegistrationRequestView["program"] | null>(
    null,
  );
  const [cancelTarget, setCancelTarget] = useState<EventRegistrationRequestView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = programFilter ? requests.filter((r) => r.program.id === programFilter) : requests;
  const filterName = programFilter
    ? requests.find((r) => r.program.id === programFilter)?.program.name
    : null;

  async function resolve(r: EventRegistrationRequestView) {
    setError(null);
    try {
      await programRegistrationAdminApi.resolve(eventId, r.program.id, r.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Depois de enviar a ficha de inscrição, o programa não pode mais alterá-la; mudanças e
        cancelamentos chegam aqui como solicitações.
      </p>

      {filterName && (
        <button
          type="button"
          onClick={onClearFilter}
          className="flex items-center gap-1.5 justify-self-start rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
        >
          Programa: {filterName}
          <X className="size-3.5" />
        </button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
          Nenhuma solicitação até agora.
        </p>
      ) : (
        <div className="grid gap-3">
          {shown.map((r) => {
            const canReopen =
              r.program.selfRegistered && !!r.program.submittedAt && !r.program.reopenedAt;
            return (
              <div key={r.id} className="grid gap-2 rounded-xl border border-border/60 bg-card p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    to={`/events/${eventId}/programs/${r.program.id}`}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {r.program.name}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2">
                    {r.program.reopenedAt && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Edição liberada
                      </span>
                    )}
                    {r.type === "cancel" && !r.resolvedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setCancelTarget(r)}
                      >
                        Aceitar cancelamento
                      </Button>
                    )}
                    {canReopen && !r.resolvedAt && r.type !== "cancel" && (
                      <Button variant="outline" size="sm" onClick={() => setReopenTarget(r.program)}>
                        <Unlock data-icon="inline-start" />
                        Liberar edição
                      </Button>
                    )}
                  </div>
                </div>
                <RegistrationRequestItem
                  request={r}
                  action={
                    !r.resolvedAt && (
                      <button
                        type="button"
                        onClick={() => void resolve(r)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Marcar como resolvido
                      </button>
                    )
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Aceitar cancelamento"
        description={`O programa ${cancelTarget?.program.name} sai do evento: as equipes, os atletas e as apresentações dele no cronograma são removidos, e ele continua no evento só como espectador (pode se inscrever de novo). O programa recebe um email avisando. Essa ação não pode ser desfeita.`}
        confirmLabel="Aceitar e remover"
        confirmingLabel="Removendo..."
        onConfirm={async () => {
          if (!cancelTarget) return;
          await programRegistrationAdminApi.acceptCancel(eventId, cancelTarget.program.id, cancelTarget.id);
          onChanged();
        }}
      />
      <ConfirmDialog
        open={reopenTarget !== null}
        onOpenChange={(open) => !open && setReopenTarget(null)}
        title="Liberar edição"
        description={`O programa ${reopenTarget?.name} poderá mudar equipes, categorias e atletas da ficha e reenviar a inscrição (até o evento começar). Ele recebe um email avisando.`}
        confirmLabel="Liberar"
        confirmingLabel="Liberando..."
        confirmVariant="default"
        onConfirm={async () => {
          if (!reopenTarget) return;
          await programRegistrationAdminApi.reopen(eventId, reopenTarget.id);
          onChanged();
        }}
      />
    </div>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ClipboardList, MessageSquare, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormError } from "@/components/FormError";
import {
  resolveRows,
  rowsIncomplete,
  suggestTeam,
  TeamCategoryRowsEditor,
  type TeamCategoryRow,
} from "@/components/TeamCategoryRowsEditor";
import { getAvatarColor } from "@/lib/avatarColor";
import { pluralize } from "@/lib/programAthletes";
import { cn } from "@/lib/utils";
import {
  ApiError,
  registrationApi,
  teamsApi,
  type AthleteRequestStatus,
  type ProgramAthleteRequestView,
  type ProgramRegistrationView,
} from "@/api/client";

const STATUS_LABELS: Record<AthleteRequestStatus, string> = {
  draft: "Rascunho",
  submitted: "Aguardando você",
  changes_requested: "Correção pedida",
  approved: "Aprovado",
  rejected: "Recusado",
  correction_requested: "Correção pedida pelo atleta",
};

const STATUS_STYLES: Record<AthleteRequestStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  changes_requested: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  correction_requested: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  rejected: "bg-destructive/10 text-destructive",
};

// Valor do seletor de equipe que cria uma equipe nova na aprovação.

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

// Aba "Pedidos de atletas" da ficha do programa (2026-10-10): atletas que
// pediram inscrição pelo programa. Aprovar escolhe a equipe de cada
// categoria (dá pra trocar as categorias antes) e escala o atleta; pedir
// correção devolve o pedido ao atleta; recusar encerra (ele pode pedir de
// novo). Enviar a ficha exige responder os pedidos que aguardam.
export function AthleteRequestsTab({
  eventId,
  view,
  editable,
  onChanged,
  onOpenData,
}: {
  eventId: string;
  view: ProgramRegistrationView;
  editable: boolean;
  // A ficha mudou (aprovação escala o atleta, cria equipe).
  onChanged: () => Promise<void> | void;
  onOpenData: (target: { athleteId: string; name: string }) => void;
}) {
  const [requests, setRequests] = useState<ProgramAthleteRequestView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<ProgramAthleteRequestView | null>(null);
  const [answerTarget, setAnswerTarget] = useState<{
    request: ProgramAthleteRequestView;
    kind: "changes" | "reject" | "keep";
  } | null>(null);

  async function load() {
    try {
      setRequests(await registrationApi.listAthleteRequests(eventId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os pedidos.");
    }
  }

  useEffect(() => {
    void load();
    // Recarrega quando a ficha muda (ex.: número de pendentes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, view.athleteRequestsPendingCount]);

  async function afterAnswer() {
    await load();
    await onChanged();
  }

  const waiting =
    requests?.filter((r) => r.status === "submitted" || r.status === "correction_requested") ?? [];
  const withAthlete = requests?.filter((r) => r.status === "changes_requested") ?? [];
  const answered =
    requests?.filter((r) => r.status === "approved" || r.status === "rejected") ?? [];

  return (
    <section className="grid gap-5">
      <div>
        <p className="text-sm text-muted-foreground">
          Atletas que pediram inscrição pelo seu programa. Aprove escolhendo a equipe de cada
          categoria, peça uma correção ou recuse.
          {editable && " Para enviar a ficha, responda os pedidos que aguardam você."}
        </p>
      </div>

      <FormError message={error} />

      {requests !== null && requests.length === 0 && (
        <p className="rounded-xl border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
          Nenhum pedido ainda. Atletas pedem inscrição pela conta deles, informando o email do seu
          programa.
        </p>
      )}

      <RequestGroup title="Aguardando você" requests={waiting}>
        {(request) => (
          <RequestCard
            key={request.id}
            request={request}
            onOpenData={onOpenData}
            onEditCategories={editable ? () => setApproveTarget(request) : undefined}
            actions={
              editable && (
                <>
                  <Button size="sm" onClick={() => setApproveTarget(request)}>
                    <Check data-icon="inline-start" />
                    {request.status === "correction_requested" ? "Aprovar com mudanças" : "Aprovar"}
                  </Button>
                  {request.status === "correction_requested" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAnswerTarget({ request, kind: "keep" })}
                    >
                      Manter como está
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAnswerTarget({ request, kind: "changes" })}
                      >
                        <MessageSquare data-icon="inline-start" />
                        Pedir correção
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setAnswerTarget({ request, kind: "reject" })}
                      >
                        Recusar
                      </Button>
                    </>
                  )}
                </>
              )
            }
          />
        )}
      </RequestGroup>

      <RequestGroup
        title="Com o atleta para correção"
        requests={withAthlete}
        hint="O atleta foi avisado e reenvia depois de corrigir. Você também pode aprovar como está."
      >
        {(request) => (
          <RequestCard
            key={request.id}
            request={request}
            onOpenData={onOpenData}
            onEditCategories={editable ? () => setApproveTarget(request) : undefined}
            actions={
              editable && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setApproveTarget(request)}>
                    <Check data-icon="inline-start" />
                    Aprovar mesmo assim
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setAnswerTarget({ request, kind: "reject" })}
                  >
                    Recusar
                  </Button>
                </>
              )
            }
          />
        )}
      </RequestGroup>

      <RequestGroup title="Respondidos" requests={answered}>
        {(request) => <RequestCard key={request.id} request={request} onOpenData={onOpenData} />}
      </RequestGroup>

      <ApproveDialog
        eventId={eventId}
        view={view}
        request={approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        onApproved={afterAnswer}
      />
      <AnswerDialog
        eventId={eventId}
        target={answerTarget}
        onOpenChange={(open) => !open && setAnswerTarget(null)}
        onAnswered={afterAnswer}
      />
    </section>
  );
}

function RequestGroup({
  title,
  hint,
  requests,
  children,
}: {
  title: string;
  hint?: string;
  requests: ProgramAthleteRequestView[];
  children: (request: ProgramAthleteRequestView) => ReactNode;
}) {
  if (requests.length === 0) return null;
  return (
    <div className="grid gap-2">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {title} <span className="font-normal text-muted-foreground">({requests.length})</span>
        </h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">{requests.map(children)}</div>
    </div>
  );
}

function RequestCard({
  request,
  actions,
  onOpenData,
  onEditCategories,
}: {
  request: ProgramAthleteRequestView;
  actions?: ReactNode;
  onOpenData: (target: { athleteId: string; name: string }) => void;
  // Lápis ao lado das categorias: abre o mesmo popup de aprovar.
  onEditCategories?: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: getAvatarColor(request.athleteId) }}
        >
          {initials(request.athleteName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate font-medium text-foreground">{request.athleteName}</p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                STATUS_STYLES[request.status],
              )}
            >
              {STATUS_LABELS[request.status]}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {request.athleteEmail}
            {request.submittedAt &&
              ` · enviado em ${new Date(request.submittedAt).toLocaleDateString("pt-BR")}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {request.categories.map((c) => (
          <span
            key={c.id}
            className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          >
            {c.name}
          </span>
        ))}
        {onEditCategories && (
          <button
            type="button"
            onClick={onEditCategories}
            title="Editar categorias e equipes"
            aria-label="Editar categorias e equipes"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>

      {request.status === "correction_requested" && request.note && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          Correção pedida: <span className="whitespace-pre-line">{request.note}</span>
        </p>
      )}
      {request.status !== "correction_requested" && request.responseMessage && (
        <p className="text-sm text-muted-foreground">
          Sua resposta: <span className="text-foreground">{request.responseMessage}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenData({ athleteId: request.athleteId, name: request.athleteName })}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ClipboardList className="size-4" />
          Ver dados e documentos
        </button>
        {request.pendingCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-3" />
            {request.pendingCount === 1 ? "Falta 1 item" : `Faltam ${request.pendingCount} itens`}
          </span>
        )}
      </div>

      {actions && <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{actions}</div>}
    </div>
  );
}

// Aprovação: uma linha por categoria, com a equipe. As categorias podem
// mudar (o atleta pediu, o programa decide). Sugestão: a única equipe do
// programa já na categoria vem marcada.
function ApproveDialog({
  eventId,
  view,
  request,
  onOpenChange,
  onApproved,
}: {
  eventId: string;
  view: ProgramRegistrationView;
  request: ProgramAthleteRequestView | null;
  onOpenChange: (open: boolean) => void;
  onApproved: () => Promise<void>;
}) {
  const teams = view.program?.teams ?? [];
  const [rows, setRows] = useState<TeamCategoryRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!request) return;
    // Correção de inscrição aprovada: parte de onde o atleta está hoje.
    setRows(
      request.status === "correction_requested" && request.entries.length > 0
        ? request.entries.map((e) => ({ categoryId: e.categoryId, teamId: e.teamId, newTeamName: "" }))
        : request.categories.map((c) => ({
            categoryId: c.id,
            teamId: suggestTeam(teams, c.id),
            newTeamName: "",
          })),
    );
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const incomplete = rowsIncomplete(rows);

  async function approve() {
    if (!request || !view.program) return;
    setSaving(true);
    setError(null);
    try {
      const programId = view.program.id;
      const entries = await resolveRows(
        rows,
        async (name) => (await teamsApi.create(eventId, programId, { name })).id,
      );
      await registrationApi.approveAthleteRequest(eventId, request.id, entries);
      await onApproved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível aprovar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={request !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-lg sm:p-8">
        <div className="grid gap-1">
          <DialogTitle>Aprovar {request?.athleteName}</DialogTitle>
          <DialogDescription>
            Escolha a equipe em cada categoria. Você pode tirar ou acrescentar categorias antes de
            aprovar. O atleta é avisado e segue para o pagamento.
          </DialogDescription>
        </div>

        <TeamCategoryRowsEditor
          rows={rows}
          onChange={setRows}
          teams={teams}
          categories={view.categories}
          max={view.maxCategoriesPerAthlete ?? null}
        />

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          {pluralize(rows.length, "categoria", "categorias")}. Regras de idade, número de atletas e
          crossover continuam aparecendo como pendências da ficha.
        </p>

        <FormError message={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void approve()} disabled={saving || rows.length === 0 || incomplete}>
            {saving ? "Aprovando..." : "Aprovar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Pedir correção (mensagem obrigatória) ou recusar (mensagem opcional).
function AnswerDialog({
  eventId,
  target,
  onOpenChange,
  onAnswered,
}: {
  eventId: string;
  target: { request: ProgramAthleteRequestView; kind: "changes" | "reject" | "keep" } | null;
  onOpenChange: (open: boolean) => void;
  onAnswered: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reject = target?.kind === "reject";
  const keep = target?.kind === "keep";

  useEffect(() => {
    setMessage("");
    setError(null);
  }, [target]);

  async function send() {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      if (keep) {
        await registrationApi.keepAthleteRequest(eventId, target.request.id, message.trim());
      } else if (reject) {
        await registrationApi.rejectAthleteRequest(eventId, target.request.id, message.trim());
      } else {
        await registrationApi.requestAthleteChanges(eventId, target.request.id, message.trim());
      }
      await onAnswered();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-md sm:p-8">
        <div className="grid gap-1">
          <DialogTitle>{keep ? "Manter como está" : reject ? "Recusar pedido" : "Pedir correção"}</DialogTitle>
          <DialogDescription>
            {keep
              ? `A inscrição de ${target?.request.athleteName} continua aprovada, sem mudanças. Ele é avisado por email.`
              : reject
              ? `${target?.request.athleteName} é avisado por email e pode fazer um novo pedido.`
              : `Diga o que ${target?.request.athleteName} precisa corrigir. Ele recebe sua mensagem e reenvia o pedido.`}
          </DialogDescription>
        </div>
        <Textarea
          autoFocus
          value={message}
          maxLength={2000}
          placeholder={keep || reject ? "Motivo (opcional)" : "Ex.: escolha só o nível 2."}
          onChange={(e) => setMessage(e.target.value)}
        />
        <FormError message={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant={reject ? "destructive" : "default"}
            onClick={() => void send()}
            disabled={saving || (!reject && !keep && !message.trim())}
          >
            {saving ? "Enviando..." : keep ? "Manter" : reject ? "Recusar" : "Enviar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

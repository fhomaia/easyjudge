import { RegulationDocumentsMenu } from "@/components/RegulationDocumentsMenu";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Info, Users } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { PageLoadingOverlay } from "@/components/PageLoadingOverlay";
import { EventThumbnail } from "@/components/EventThumbnail";
import { FormError } from "@/components/FormError";
import {
  AthleteRequirementsPanel,
  type RequirementsAdapter,
} from "@/components/AthleteRequirementsPanel";
import { useAuthStore } from "@/store/auth";
import { formatDeadline } from "@/lib/registrationWindow";
import { cn } from "@/lib/utils";
import {
  ApiError,
  athleteRegistrationApi,
  usersApi,
  type AthleteRegistrationEntry,
  type AthleteRegistrationEvent,
  type AthleteRequirementsView,
  type UserProfile,
} from "@/api/client";

// Itens obrigatórios que faltam (mesma regra da API, pendingRequirements).
function pendingItems(view: AthleteRequirementsView, includeOptionalDocs: boolean) {
  return view.items.filter((item) => {
    if (!item.applies || !item.requirement.required) return false;
    if (item.requirement.kind === "document") {
      if (view.allowSubmitWithoutDocuments && !includeOptionalDocs) return false;
      return !item.document || item.document.status === "contested";
    }
    return !item.value;
  });
}

// Inscrição vista pelo atleta (2026-10-06): o programa colocou o atleta
// numa categoria e aqui ele PODE completar o que falta (dados e
// documentos) e enviar a parte dele. Nada é obrigatório pro atleta: o
// programa pode fazer tudo por ele e nada espera o atleta. Depois que o
// programa OU o atleta envia, a tela vira "Minha inscrição" (categorias em
// destaque; documentos ainda podem ser trocados até o prazo). Tudo salva
// na hora; documento novo fica guardado na biblioteca da conta.
export function AthleteRegistrationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<AthleteRegistrationEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  const load = useCallback(() => {
    if (!id) return;
    athleteRegistrationApi
      .get(id)
      .then(setView)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar a inscrição."),
      );
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-dvh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      <main className="relative flex-1 overflow-y-auto pt-14 sm:pt-0">
        <PageLoadingOverlay loading={view === null && !error} />
        <div className="grid w-full grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-10 sm:py-10 lg:px-16">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 justify-self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Meus eventos
          </button>

          {error && <FormError message={error} />}

          {view && (
            <>
              <div className="flex min-w-0 items-center gap-4 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
                <EventThumbnail
                  name={view.name}
                  logoUrl={view.logoUrl}
                  className="size-14 shrink-0 rounded-xl text-base sm:size-16"
                />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Sua inscrição no evento</p>
                  <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
                    {view.name}
                  </h1>
                  {/* Sem data limite: nada a mostrar. */}
                  {(!view.open || view.registrationDeadline) && (
                  <p
                    className={cn(
                      "mt-0.5 text-sm",
                      view.open
                        ? "text-muted-foreground"
                        : "font-medium text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {view.open
                      ? view.registrationDeadline
                        ? `Complete até ${formatDeadline(view.registrationDeadline)}, 23:59`
                        : null
                      : "Inscrições encerradas"}
                  </p>
                  )}
                  <RegulationDocumentsMenu
                    documents={view.regulationDocuments ?? []}
                    className="mt-2"
                  />
                </div>
              </div>

              {view.entries.map((entry) => (
                <EntryCard
                  key={entry.programId}
                  eventId={view.eventId}
                  entry={entry}
                />
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function EntryCard({ eventId, entry }: { eventId: string; entry: AthleteRegistrationEntry }) {
  const [requirements, setRequirements] = useState(entry.requirements);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const adapter = useMemo<RequirementsAdapter>(
    () => ({
      list: async () => {
        const next = await athleteRegistrationApi.get(eventId);
        // Por programa: o id muda de `program:<id>` pro atleta do evento
        // quando ele salva algo antes de ter categoria.
        const own = next.entries.find((e) => e.programId === entry.programId);
        if (!own) throw new ApiError("Inscrição não encontrada.", 404);
        return own.requirements;
      },
      set: (requirementId, value) =>
        athleteRegistrationApi.set(eventId, entry.athleteId, requirementId, value),
      uploadDocument: (requirementId, files, libraryIds) =>
        athleteRegistrationApi.uploadDocument(eventId, entry.athleteId, requirementId, files, libraryIds),
      removeDocument: (requirementId) =>
        athleteRegistrationApi.removeDocument(eventId, entry.athleteId, requirementId),
      openFile: (requirementId, index, fileName) =>
        athleteRegistrationApi.openFile(eventId, entry.athleteId, requirementId, index, fileName),
      useLibrary: true,
    }),
    [eventId, entry.athleteId],
  );

  const missing = pendingItems(requirements, false);
  const laterDocs = requirements.allowSubmitWithoutDocuments
    ? pendingItems(requirements, true).filter((i) => i.requirement.kind === "document")
    : [];
  const editable = requirements.dataEditable || requirements.documentsEditable;
  const submitted = requirements.programSubmitted || !!requirements.athleteSubmittedAt;
  const pendingLabels = [...missing, ...laterDocs].map((i) => i.requirement.label.toLowerCase());

  return (
    <section className="grid gap-4 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Users className="size-4 text-muted-foreground" />
        {entry.programName}
      </p>

      {submitted && (
        <>
          <p className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            {requirements.programSubmitted
              ? `Inscrição enviada pelo ${entry.programName}.`
              : `Você enviou sua inscrição em ${new Date(requirements.athleteSubmittedAt as string).toLocaleDateString("pt-BR")}.`}
          </p>
          <div className="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2.5 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Para alterar dados ou documentos já enviados, peça ao {entry.programName}. Por aqui
              você só envia documentos que ainda faltam ou que foram contestados.
            </span>
          </div>
        </>
      )}

      <dl>
        <AthleteRequirementsPanel
          adapter={adapter}
          initialView={entry.requirements}
          onChanged={setRequirements}
        />
      </dl>

      {/* Categorias: quem escolhe é o programa, o atleta só consulta. */}
      <div className="grid gap-2 rounded-lg border border-border/60 p-3 sm:p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Suas categorias</p>
          <p className="text-xs text-muted-foreground">
            O {entry.programName} é o responsável por indicar as categorias em que você vai
            competir. Se algo estiver errado, fale com o seu programa.
          </p>
        </div>
        {entry.categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            O {entry.programName} ainda não indicou suas categorias.
          </p>
        ) : (
        <div className="flex flex-wrap gap-1.5">
          {entry.categories.map((c) => (
            <span
              key={`${c.teamName}-${c.categoryName}`}
              className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {c.teamName} · {c.categoryName}
            </span>
          ))}
        </div>
        )}
      </div>

      {!editable ? (
        <p className="text-sm text-muted-foreground">As inscrições deste evento estão encerradas.</p>
      ) : submitted ? (
        pendingLabels.length > 0 && (
          <PendingBox labels={pendingLabels} />
        )
      ) : (
        <div className="grid gap-2">
          {missing.length > 0 ? (
            <PendingBox labels={missing.map((i) => i.requirement.label.toLowerCase())} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Tudo preenchido! Envie para avisar o seu programa.
            </p>
          )}
          <Button
            className="w-full sm:w-auto sm:justify-self-end"
            disabled={missing.length > 0}
            onClick={() => setConfirmOpen(true)}
          >
            Enviar inscrição
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Enviar inscrição"
        description={`Confirma que seus dados e documentos estão certos? O ${entry.programName} e o organizador do evento vão ver o que você enviou.`}
        confirmLabel="Enviar"
        confirmingLabel="Enviando..."
        confirmVariant="default"
        onConfirm={async () => {
          setRequirements(await athleteRegistrationApi.submit(eventId, entry.athleteId));
          setConfirmOpen(false);
        }}
      />
    </section>
  );
}

// Pendências em amarelo, uma por tópico.
function PendingBox({ labels }: { labels: string[] }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="grid gap-1">
        <p className="font-medium">Pendências:</p>
        <ul className="list-disc space-y-0.5 pl-5">
          {labels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

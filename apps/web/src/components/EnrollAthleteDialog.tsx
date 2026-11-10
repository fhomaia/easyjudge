import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, Check, Search, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/FormError";
import {
  AthleteRequirementsPanel,
  programRequirementsAdapter,
} from "@/components/AthleteRequirementsPanel";
import {
  resolveRows,
  rowsIncomplete,
  TeamCategoryRowsEditor,
  type TeamCategoryRow,
} from "@/components/TeamCategoryRowsEditor";
import { getAvatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";
import {
  ApiError,
  athleteRequirementsApi,
  athletesApi,
  registrationApi,
  teamsApi,
  type AthleteLinkView,
  type AthleteRequirementsView,
  type ProgramRegistrationView,
} from "@/api/client";

type Step = "athlete" | "categories" | "data";

// A lista do elenco cresce de tanto em tanto ao rolar até o fim.
const ROSTER_BATCH = 15;

const STEPS: { key: Step; label: string }[] = [
  { key: "athlete", label: "Atleta" },
  { key: "categories", label: "Categorias" },
  { key: "data", label: "Dados e documentos" },
];
// Obrigatório que falta (documento só conta sem a permissão do produtor de
// enviar depois). Mesma regra do envio pelo atleta.
export function pendingItems(view: AthleteRequirementsView, includeOptionalDocs: boolean) {
  return view.items.filter((item) => {
    if (!item.applies || !item.requirement.required) return false;
    if (item.requirement.kind === "document") {
      if (view.allowSubmitWithoutDocuments && !includeOptionalDocs) return false;
      return !item.document || item.document.status === "contested";
    }
    return !item.value;
  });
}

// "Inscrever atleta" na ficha do programa (2026-10-10): escolhe um atleta
// do elenco que ainda não compete (ou cadastra um novo), as categorias com
// a equipe de cada uma e, por fim, os dados e documentos pedidos pelo
// organizador. A inscrição é gravada ao sair da etapa de categorias.
export function EnrollAthleteDialog({
  open,
  onOpenChange,
  initialLink = null,
  eventId,
  view,
  roster,
  enrolledEmails,
  onLinkCreated,
  onEnrolled,
  onDataChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Atleta já escolhido: abre direto na etapa de categorias.
  initialLink?: AthleteLinkView | null;
  eventId: string;
  view: ProgramRegistrationView;
  // Elenco do programa (vínculo confirmado) e quem dele já está inscrito
  // em alguma categoria do evento.
  roster: AthleteLinkView[];
  enrolledEmails: string[];
  onLinkCreated: (link: AthleteLinkView) => void;
  onEnrolled: (view: ProgramRegistrationView) => Promise<void>;
  onDataChanged: () => void;
}) {
  const [step, setStep] = useState<Step>("athlete");
  // Primeiro passo: escolher do elenco ou cadastrar um atleta novo.
  const [mode, setMode] = useState<"roster" | "new">("roster");
  const [choice, setChoice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(ROSTER_BATCH);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<AthleteLinkView | null>(null);
  const [rows, setRows] = useState<TeamCategoryRow[]>([]);
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<AthleteRequirementsView | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(roster.length === 0 && !initialLink ? "new" : "roster");
    setChoice(initialLink?.id ?? null);
    setSearch("");
    setVisible(ROSTER_BATCH);
    setFullName("");
    setEmail("");
    setLink(initialLink);
    setStep(initialLink ? "categories" : "athlete");
    setRows([]);
    setAthleteId(null);
    setRequirements(null);
    setError(null);
    // Só ao abrir: o elenco muda durante o fluxo (atleta novo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const programId = view.program?.id ?? null;
  const teams = view.program?.teams ?? [];
  const term = search.trim().toLowerCase();
  const enrolled = new Set(enrolledEmails.map((e) => e.toLowerCase()));
  const isEnrolled = (l: AthleteLinkView) => enrolled.has(l.email.toLowerCase());
  const sortedRoster = [...roster].sort(
    (a, b) =>
      Number(isEnrolled(a)) - Number(isEnrolled(b)) ||
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "pt-BR"),
  );
  const filtered = sortedRoster.filter(
    (l) =>
      !term ||
      `${l.firstName} ${l.lastName}`.toLowerCase().includes(term) ||
      l.email.toLowerCase().includes(term),
  );
  const pageItems = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  // Chegou perto do fim da lista: mostra mais um lote.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (items) => {
        if (items.some((i) => i.isIntersecting)) setVisible((v) => v + ROSTER_BATCH);
      },
      { root: listRef.current, rootMargin: "80px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, visible, mode, step]);
  const athleteName = link ? `${link.firstName} ${link.lastName}`.trim() : "";

  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function continueFromAthlete(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      if (mode === "new") {
        // Email de alguém que já está no elenco: usa esse atleta em vez de
        // dar erro de duplicado.
        const existing = roster.find((l) => l.email.toLowerCase() === email.trim().toLowerCase());
        if (existing) {
          if (isEnrolled(existing)) {
            throw new ApiError(
              `${`${existing.firstName} ${existing.lastName}`.trim()} já está inscrito neste evento.`,
              409,
            );
          }
          setLink(existing);
          setStep("categories");
          return;
        }
        // Nome completo num campo só, separado no primeiro espaço (como
        // CreateAthleteDialog). O `pattern` garante as duas partes.
        const name = fullName.trim().replace(/\s+/g, " ");
        const i = name.indexOf(" ");
        const created = await athletesApi.create({
          firstName: name.slice(0, i),
          lastName: name.slice(i + 1),
          email,
        });
        onLinkCreated(created);
        setLink(created);
      } else {
        setLink(roster.find((l) => l.id === choice) ?? null);
      }
      setStep("categories");
    });
  }

  const plannedCategoryIds = useMemo(() => rows.map((r) => r.categoryId), [rows]);

  // Categorias escolhidas (ainda não gravadas): o atleta do evento nasce
  // agora, pra receber os dados e documentos pedidos pra elas.
  function continueToData() {
    if (!link || !programId) return;
    void run(async () => {
      const id = athleteId ?? (await registrationApi.prepareAthlete(eventId, link.id)).athleteId;
      setAthleteId(id);
      setRequirements(await athleteRequirementsApi.list(eventId, programId, id, plannedCategoryIds));
      setStep("data");
    });
  }

  // Só agora o atleta entra nas categorias, com o obrigatório preenchido
  // (mesmas regras do pedido feito pelo próprio atleta).
  function enroll() {
    if (!link || !programId) return;
    void run(async () => {
      const entries = await resolveRows(
        rows,
        async (name) => (await teamsApi.create(eventId, programId, { name })).id,
      );
      await onEnrolled(await registrationApi.enrollAthlete(eventId, link.id, entries));
      enrolledRef.current = true;
      onOpenChange(false);
    });
  }

  // Fechou antes de inscrever: o atleta do evento sem categoria e sem
  // dado sai na limpeza (com dado, fica guardado pra continuar depois).
  const enrolledRef = useRef(false);
  function handleOpenChange(next: boolean) {
    if (!next && link && athleteId && !enrolledRef.current) {
      void registrationApi.setAthleteEntries(eventId, link.id, []).then(onEnrolled).catch(() => {});
    }
    if (!next) enrolledRef.current = false;
    onOpenChange(next);
  }

  const adapter = useMemo(
    () =>
      athleteId && programId
        ? programRequirementsAdapter(eventId, programId, athleteId, { plannedCategoryIds })
        : null,
    [eventId, programId, athleteId, plannedCategoryIds],
  );
  const missing = requirements ? pendingItems(requirements, false) : [];
  const laterDocs =
    requirements?.allowSubmitWithoutDocuments
      ? pendingItems(requirements, true).filter((i) => i.requirement.kind === "document")
      : [];

  const current = STEPS.findIndex((s) => s.key === step);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-xl sm:p-8">
        <div className="grid gap-1">
          <DialogTitle>{athleteName ? `Inscrever ${athleteName}` : "Inscrever atleta"}</DialogTitle>
          <DialogDescription>
            {step === "athlete"
              ? "Escolha um atleta do seu elenco ou cadastre um novo."
              : step === "categories"
                ? "Escolha as categorias e a equipe de cada uma."
                : "Preencha o que o organizador pede para essas categorias. O atleta só entra nas categorias com o obrigatório completo."}
          </DialogDescription>
        </div>

        <EnrollStepper current={current} />

        <FormError message={error} />

        {step === "athlete" && (
          <form onSubmit={continueFromAthlete} className="grid gap-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(
                [
                  ["roster", "Do seu elenco"],
                  ["new", "Novo atleta"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setMode(key);
                    setError(null);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    mode === key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {key === "new" && <UserPlus className="size-4" />}
                  {label}
                </button>
              ))}
            </div>

            {mode === "roster" ? (
              roster.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">
                  Seu elenco ainda não tem atletas. Use "Novo atleta".
                </p>
              ) : (
                <div className="grid gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      aria-label="Buscar atleta"
                      placeholder="Buscar por nome ou email"
                      className="pl-9"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setVisible(ROSTER_BATCH);
                        listRef.current?.scrollTo({ top: 0 });
                      }}
                    />
                  </div>
                  <div ref={listRef} className="grid max-h-80 gap-1.5 overflow-y-auto">
                    {pageItems.map((l) => {
                      const name = `${l.firstName} ${l.lastName}`.trim();
                      const selected = choice === l.id;
                      const done = isEnrolled(l);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          disabled={done}
                          onClick={() => setChoice(l.id)}
                          className={cn(
                            "flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                            done
                              ? "cursor-not-allowed border-border/60 opacity-60"
                              : selected
                                ? "border-primary bg-primary/5"
                                : "border-border/60 hover:bg-muted/50",
                          )}
                        >
                          <span
                            className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: getAvatarColor(l.id) }}
                          >
                            {initials(name)}
                          </span>
                          <span className="grid min-w-0 flex-1">
                            <span className="truncate text-sm font-medium text-foreground">{name}</span>
                            <span className="truncate text-xs text-muted-foreground">{l.email}</span>
                          </span>
                          {done ? (
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              Já inscrito
                            </span>
                          ) : (
                            selected && <Check className="size-4 shrink-0 text-primary" />
                          )}
                        </button>
                      );
                    })}
                    {filtered.length === 0 && (
                      <p className="py-3 text-center text-sm text-muted-foreground">
                        Nenhum atleta encontrado.
                      </p>
                    )}
                    {hasMore && (
                      <div ref={sentinelRef} className="py-2 text-center text-xs text-muted-foreground">
                        Carregando mais...
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="enroll-athlete-name">Nome completo</Label>
                  <Input
                    id="enroll-athlete-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    pattern="\s*\S+\s+\S.*"
                    title="Informe o nome completo (nome e sobrenome)."
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="enroll-athlete-email">Email</Label>
                  <Input
                    id="enroll-athlete-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  O atleta entra no seu elenco. Sem conta na plataforma, o vínculo é reclamado quando
                  ele se cadastrar com esse email.
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || (mode === "roster" && !choice)}>
                {saving ? "Salvando..." : "Continuar"}
              </Button>
            </div>
          </form>
        )}

        {step === "categories" && (
          <div className="grid gap-4">
            <TeamCategoryRowsEditor
              rows={rows}
              onChange={setRows}
              teams={teams}
              categories={view.categories}
              max={view.maxCategoriesPerAthlete ?? null}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  // Volta com o atleta já escolhido (o novo já está no elenco).
                  if (link) {
                    setMode("roster");
                    setChoice(link.id);
                  }
                  setError(null);
                  setStep("athlete");
                }}
              >
                Voltar
              </Button>
              <Button
                disabled={saving || rows.length === 0 || rowsIncomplete(rows)}
                onClick={continueToData}
              >
                {saving ? "Carregando..." : "Continuar"}
              </Button>
            </div>
          </div>
        )}

        {step === "data" && (
          <div className="grid gap-4">
            {adapter && requirements ? (
              <AthleteRequirementsPanel
                adapter={adapter}
                initialView={requirements}
                onChanged={(next) => {
                  setRequirements(next);
                  onDataChanged();
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Não foi possível carregar os dados do atleta.</p>
            )}
            {missing.length > 0 ? (
              <div className="grid gap-1 rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="size-4 shrink-0" />
                  Para inscrever, falta:
                </p>
                <p>{missing.map((i) => i.requirement.label.toLowerCase()).join(", ")}.</p>
              </div>
            ) : laterDocs.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                Documentos que podem ser enviados depois, até o prazo:{" "}
                {laterDocs.map((i) => i.requirement.label.toLowerCase()).join(", ")}.
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setStep("categories")} disabled={saving}>
                Voltar
              </Button>
              <Button disabled={saving || !requirements || missing.length > 0} onClick={enroll}>
                {saving ? "Inscrevendo..." : "Inscrever atleta"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// Etapas do "Inscrever atleta" (também usado pelo produtor).
export function EnrollStepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-xs">
      {STEPS.map((s, index) => (
        <li key={s.key} className="flex items-center gap-1.5">
          {index > 0 && <span className="h-px w-3 bg-border sm:w-5" />}
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
              index < current && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
              index === current && "bg-primary text-primary-foreground",
              index > current && "bg-muted text-muted-foreground",
            )}
          >
            {index < current && <Check className="size-3" />}
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

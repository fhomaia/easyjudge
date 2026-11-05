import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/FormError";
import { AthleteChecklist } from "@/components/AthleteChecklist";
import {
  AthleteRequirementsPanel,
  programRequirementsAdapter,
} from "@/components/AthleteRequirementsPanel";
import { EnrollStepper, pendingItems } from "@/components/EnrollAthleteDialog";
import { athleteName, entryKey } from "@/lib/programAthletes";
import {
  ApiError,
  athleteRequirementsApi,
  programAthletesApi,
  type AthleteRequirementsView,
  type ProgramAthlete,
  type ProgramWithTeams,
} from "@/api/client";

type Step = "athlete" | "categories" | "data";
const STEP_INDEX: Record<Step, number> = { athlete: 0, categories: 1, data: 2 };

// "Inscrever atleta" do produtor na tela do programa (2026-10-11): mesmo
// fluxo da ficha do programa (EnrollAthleteDialog), mas sempre com um
// atleta novo: o produtor não vê o elenco do programa nem quem ainda não
// enviou a ficha (staffVisibleIds na API). Atleta → categorias (pares
// equipe+categoria do programa) → dados e documentos; as categorias só são
// gravadas no fim, com o obrigatório completo.
export function ProducerEnrollAthleteDialog({
  open,
  onOpenChange,
  eventId,
  program,
  athletes,
  onAthleteSaved,
  onEnrolled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  program: ProgramWithTeams;
  athletes: ProgramAthlete[];
  // Atleta criado (ou com dados alterados) no meio do fluxo.
  onAthleteSaved: (athlete: ProgramAthlete) => void;
  onEnrolled: (athlete: ProgramAthlete) => void;
}) {
  const [step, setStep] = useState<Step>("athlete");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [athlete, setAthlete] = useState<ProgramAthlete | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [requirements, setRequirements] = useState<AthleteRequirementsView | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("athlete");
    setFullName("");
    setEmail("");
    setAthlete(null);
    setSelected(new Set());
    setRequirements(null);
    setError(null);
    // Só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const items = program.teams.flatMap((team) =>
    team.categories.map((category) => ({
      id: entryKey(team.id, category.id),
      label: category.name,
      hint: `Equipe ${team.name}`,
    })),
  );
  const entries = useMemo(
    () =>
      Array.from(selected).map((key) => {
        const [teamId, categoryId] = key.split(":");
        return { teamId, categoryId };
      }),
    [selected],
  );
  const plannedCategoryIds = useMemo(
    () => Array.from(new Set(entries.map((e) => e.categoryId))),
    [entries],
  );

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
      // Email de um atleta que o produtor já vê sem categoria (cadastrado
      // por ele antes): usa esse.
      const existing = athletes.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
      if (existing) {
        if (existing.entries.length > 0) {
          throw new ApiError(`${athleteName(existing)} já está inscrito neste programa.`, 409);
        }
        setAthlete(existing);
        setStep("categories");
        return;
      }
      // Nome completo num campo só, separado no primeiro espaço.
      const name = fullName.trim().replace(/\s+/g, " ");
      const i = name.indexOf(" ");
      const created = await programAthletesApi.create(eventId, program.id, {
        firstName: name.slice(0, i),
        lastName: name.slice(i + 1),
        email: email.trim(),
        cpf: null,
        birthDate: null,
      });
      onAthleteSaved(created);
      setAthlete(created);
      setStep("categories");
    });
  }

  function continueToData() {
    if (!athlete) return;
    void run(async () => {
      setRequirements(
        await athleteRequirementsApi.list(eventId, program.id, athlete.id, plannedCategoryIds),
      );
      setStep("data");
    });
  }

  function enroll() {
    if (!athlete) return;
    void run(async () => {
      onEnrolled(await programAthletesApi.setEntries(eventId, program.id, athlete.id, entries));
      onOpenChange(false);
    });
  }

  const adapter = useMemo(
    () =>
      athlete
        ? programRequirementsAdapter(eventId, program.id, athlete.id, {
            canContest: true,
            plannedCategoryIds,
          })
        : null,
    [eventId, program.id, athlete, plannedCategoryIds],
  );
  const missing = requirements ? pendingItems(requirements, false) : [];
  const laterDocs = requirements?.allowSubmitWithoutDocuments
    ? pendingItems(requirements, true).filter((i) => i.requirement.kind === "document")
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-xl sm:p-8">
        <div className="grid gap-1">
          <DialogTitle>{athlete ? `Inscrever ${athleteName(athlete)}` : "Inscrever atleta"}</DialogTitle>
          <DialogDescription>
            {step === "athlete"
              ? "Informe o nome e o email do atleta."
              : step === "categories"
                ? "Escolha as categorias, com a equipe de cada uma."
                : "Preencha o que é pedido para essas categorias. O atleta só entra nas categorias com o obrigatório completo."}
          </DialogDescription>
        </div>

        <EnrollStepper current={STEP_INDEX[step]} />

        <FormError message={error} />

        {step === "athlete" && (
          <form onSubmit={continueFromAthlete} className="grid gap-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="producer-enroll-name">Nome completo</Label>
                <Input
                  id="producer-enroll-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  pattern="\s*\S+\s+\S.*"
                  title="Informe o nome completo (nome e sobrenome)."
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="producer-enroll-email">Email</Label>
                <Input
                  id="producer-enroll-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Continuar"}
              </Button>
            </div>
          </form>
        )}

        {step === "categories" && (
          <div className="grid gap-4">
            <AthleteChecklist
              items={items}
              selected={selected}
              onChange={setSelected}
              searchPlaceholder="Buscar categoria ou equipe..."
              emptyMessage="Nenhuma equipe deste programa está inscrita em categorias ainda. Inscreva as equipes na aba Equipes."
              countNoun={{ singular: "categoria selecionada", plural: "categorias selecionadas" }}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  // Volta com os dados do atleta já criado (o email reaproveita).
                  if (athlete) {
                    setFullName(athleteName(athlete));
                    setEmail(athlete.email);
                  }
                  setError(null);
                  setStep("athlete");
                }}
              >
                Voltar
              </Button>
              <Button disabled={saving || selected.size === 0} onClick={continueToData}>
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
                onChanged={setRequirements}
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

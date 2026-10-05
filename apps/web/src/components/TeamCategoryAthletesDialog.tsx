import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/FormError";
import { AthleteChecklist } from "@/components/AthleteChecklist";
import { ProgramAthleteDialog } from "@/components/ProgramAthleteDialog";
import { athleteName } from "@/lib/programAthletes";
import {
  programAthletesApi,
  teamsApi,
  ApiError,
  type Category,
  type ProgramAthlete,
  type Team,
} from "@/api/client";

interface TeamCategoryAthletesDialogProps {
  eventId: string;
  programId: string;
  team: Team;
  // Categorias do evento (pra escolher ao adicionar).
  categories: Category[];
  athletes: ProgramAthlete[];
  open: boolean;
  // null = adicionar categoria à equipe; id = editar atletas dessa categoria.
  categoryId: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onAthleteCreated: (athlete: ProgramAthlete) => void;
}

export function TeamCategoryAthletesDialog({
  eventId,
  programId,
  team,
  categories,
  athletes,
  open,
  categoryId,
  onOpenChange,
  onSaved,
  onAthleteCreated,
}: TeamCategoryAthletesDialogProps) {
  const isAdd = categoryId === null;
  const [chosenCategoryId, setChosenCategoryId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Quem já estava na categoria ao abrir vem primeiro na lista (o popup
  // também serve pra ver o elenco completo, ver "+ N atletas" em
  // ProgramTeamPage). Fixo enquanto o popup está aberto, pra a lista não
  // pular ao marcar/desmarcar.
  const [initiallySelected, setInitiallySelected] = useState<Set<string>>(new Set());
  const [createAthleteOpen, setCreateAthleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChosenCategoryId(categoryId);
    const current = new Set(
      categoryId
        ? athletes
            .filter((a) =>
              a.entries.some((e) => e.teamId === team.id && e.categoryId === categoryId),
            )
            .map((a) => a.id)
        : [],
    );
    setSelected(current);
    setInitiallySelected(current);
    setError(null);
    // `athletes` fica de fora de propósito: um atleta criado aqui dentro
    // não pode zerar a seleção que já está sendo feita.
  }, [open, categoryId, team.id]);

  const linkedIds = new Set(team.categories.map((c) => c.id));
  const availableCategories = categories
    .filter((c) => !linkedIds.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const categoryName =
    categories.find((c) => c.id === chosenCategoryId)?.name ??
    team.categories.find((c) => c.id === chosenCategoryId)?.name ??
    "";

  async function handleSave() {
    if (!chosenCategoryId) return;
    setError(null);
    setLoading(true);
    try {
      if (isAdd) {
        await teamsApi.addCategory(eventId, programId, team.id, [chosenCategoryId]);
      }
      if (!isAdd || selected.size > 0) {
        await programAthletesApi.setTeamCategoryAthletes(
          eventId,
          programId,
          team.id,
          chosenCategoryId,
          Array.from(selected),
        );
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function handleAthleteCreated(athlete: ProgramAthlete) {
    onAthleteCreated(athlete);
    setSelected((prev) => new Set(prev).add(athlete.id));
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] gap-6 overflow-y-auto p-6 sm:max-w-lg sm:p-10">
          <div className="grid gap-1.5">
            <DialogTitle className="text-xl font-medium">
              {isAdd ? "Adicionar categoria" : "Atletas da categoria"}
            </DialogTitle>
            <DialogDescription>
              {isAdd
                ? `Escolha a categoria em que a equipe ${team.name} vai competir e marque os atletas. Os atletas podem ficar para depois.`
                : `${team.name} · ${categoryName}`}
            </DialogDescription>
          </div>

          <FormError message={error} />

          {isAdd && (
            <div className="grid gap-2">
              <Label>Categoria</Label>
              {availableCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  A equipe já está em todas as categorias do evento.
                </p>
              ) : (
                <Select
                  value={chosenCategoryId}
                  onValueChange={(value) => setChosenCategoryId(value as string)}
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue>
                      {(value: string | null) => (
                        <span className="truncate">
                          {value
                            ? (availableCategories.find((c) => c.id === value)?.name ?? "")
                            : "Selecione a categoria"}
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Atletas</Label>
              <button
                type="button"
                onClick={() => setCreateAthleteOpen(true)}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <Plus className="size-3.5" />
                Novo atleta
              </button>
            </div>
            <AthleteChecklist
              items={[...athletes]
                .sort(
                  (a, b) =>
                    Number(initiallySelected.has(b.id)) - Number(initiallySelected.has(a.id)) ||
                    athleteName(a).localeCompare(athleteName(b), "pt-BR"),
                )
                .map((a) => ({ id: a.id, label: athleteName(a), hint: a.email }))}
              selected={selected}
              onChange={setSelected}
              searchPlaceholder="Buscar atleta..."
              emptyMessage="Nenhum atleta cadastrado neste programa ainda."
              countNoun={{ singular: "atleta selecionado", plural: "atletas selecionados" }}
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={!chosenCategoryId || loading} onClick={handleSave}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProgramAthleteDialog
        eventId={eventId}
        programId={programId}
        open={createAthleteOpen}
        onOpenChange={setCreateAthleteOpen}
        onSaved={handleAthleteCreated}
      />
    </>
  );
}

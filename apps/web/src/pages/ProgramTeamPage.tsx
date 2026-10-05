import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { ProgramsSetupShell } from "@/components/ProgramsSetupShell";
import { EditTeamDialog } from "@/components/EditTeamDialog";
import { TeamCategoryAthletesDialog } from "@/components/TeamCategoryAthletesDialog";
import { TeamSituationBadge } from "@/components/TeamSituationBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { getAvatarColor } from "@/lib/avatarColor";
import { athleteName, pluralize, teamSituation } from "@/lib/programAthletes";
import {
  categoriesApi,
  programAthletesApi,
  programsApi,
  teamsApi,
  type Category,
  type ProgramAthlete,
  type ProgramWithTeams,
} from "@/api/client";

// Atletas mostrados em cada categoria; "+ N atletas" abre o popup de
// editar atletas, que lista quem já está na categoria primeiro.
const VISIBLE_ATHLETES = 3;

// Uma equipe de um programa (2026-10-04): as categorias em que compete e,
// em cada uma, os atletas marcados. Equipe é uma só; o elenco é por
// categoria (o mesmo atleta pode estar em várias).
export function ProgramTeamPage() {
  const { id, programId, teamId } = useParams<{
    id: string;
    programId: string;
    teamId: string;
  }>();
  const navigate = useNavigate();

  const [program, setProgram] = useState<ProgramWithTeams | null>(null);
  const [athletes, setAthletes] = useState<ProgramAthlete[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  // undefined = popup fechado; null = adicionar categoria; id = editar atletas.
  const [dialogCategoryId, setDialogCategoryId] = useState<string | null | undefined>(undefined);
  const [removeCategoryTarget, setRemoveCategoryTarget] = useState<Category | null>(null);
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [deleteTeamOpen, setDeleteTeamOpen] = useState(false);

  const load = useCallback(() => {
    if (!id || !programId) return;
    Promise.all([programsApi.get(id, programId), programAthletesApi.list(id, programId)])
      .then(([p, a]) => {
        setProgram(p);
        setAthletes(a);
      })
      .catch(() => setError("Não foi possível carregar a equipe."));
  }, [id, programId]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!id) return;
    categoriesApi.list(id).then(setCategories).catch(() => setCategories([]));
  }, [id]);

  const team = program?.teams.find((t) => t.id === teamId) ?? null;
  const programUrl = `/events/${id}/programs/${programId}`;

  useEffect(() => {
    if (program && !team) navigate(programUrl, { replace: true });
  }, [program, team, navigate, programUrl]);

  async function handleRemoveCategory() {
    if (!id || !programId || !teamId || !removeCategoryTarget) return;
    await teamsApi.removeCategory(id, programId, teamId, removeCategoryTarget.id);
    load();
  }

  async function handleDeleteTeam() {
    if (!id || !programId || !teamId) return;
    await teamsApi.remove(id, programId, teamId);
    navigate(programUrl);
  }

  const athletesByCategory = new Map<string, ProgramAthlete[]>();
  for (const athlete of athletes ?? []) {
    for (const entry of athlete.entries) {
      if (entry.teamId !== teamId) continue;
      const list = athletesByCategory.get(entry.categoryId) ?? [];
      list.push(athlete);
      athletesByCategory.set(entry.categoryId, list);
    }
  }
  const distinctAthletes = new Set(
    [...athletesByCategory.values()].flat().map((a) => a.id),
  ).size;

  return (
    <ProgramsSetupShell
      loading={(program === null || athletes === null) && !error}
      backLabel={program?.name ?? "Programa"}
      backTo={programUrl}
    >
      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {team && program && athletes && id && programId && (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div
                style={{ backgroundColor: getAvatarColor(team.id) }}
                className="flex size-14 shrink-0 items-center justify-center rounded-full text-white"
              >
                <Users className="size-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="min-w-0 truncate text-2xl font-semibold text-foreground">
                    {team.name}
                  </h1>
                  <TeamSituationBadge situation={teamSituation(team)} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {program.name} · {pluralize(distinctAthletes, "atleta", "atletas")} ·{" "}
                  {pluralize(team.categories.length, "categoria", "categorias")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:shrink-0">
              <button
                type="button"
                onClick={() => setEditTeamOpen(true)}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-3.5" />
                Editar nome
              </button>
              <button
                type="button"
                onClick={() => setDeleteTeamOpen(true)}
                aria-label="Excluir equipe"
                className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Categorias</h2>
              <p className="text-sm text-muted-foreground">
                Em cada categoria, marque os atletas que vão competir por esta equipe. Os atletas
                são opcionais.
              </p>
            </div>
            <Button className="w-full sm:w-auto" onClick={() => setDialogCategoryId(null)}>
              <Plus data-icon="inline-start" />
              Adicionar categoria
            </Button>
          </div>

          {team.categories.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
              Esta equipe ainda não está inscrita em nenhuma categoria.
            </p>
          ) : (
            <div className="grid gap-3">
              {team.categories.map((category) => {
                const list = (athletesByCategory.get(category.id) ?? []).sort((a, b) =>
                  athleteName(a).localeCompare(athleteName(b), "pt-BR"),
                );
                return (
                  <div
                    key={category.id}
                    className="grid min-w-0 gap-3 rounded-xl border border-border/60 bg-card p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate font-medium text-foreground">
                            {category.name}
                          </p>
                          <TeamSituationBadge
                            situation={list.length > 0 ? "complete" : "no_athletes"}
                          />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {pluralize(list.length, "atleta", "atletas")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => setDialogCategoryId(category.id)}
                        >
                          <Pencil data-icon="inline-start" />
                          Editar atletas
                        </Button>
                        <button
                          type="button"
                          onClick={() => setRemoveCategoryTarget(category)}
                          aria-label={`Remover ${category.name}`}
                          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                    {list.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {list.slice(0, VISIBLE_ATHLETES).map((athlete) => (
                          <span
                            key={athlete.id}
                            className="max-w-full truncate rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground"
                          >
                            {athleteName(athlete)}
                          </span>
                        ))}
                        {list.length > VISIBLE_ATHLETES && (
                          <button
                            type="button"
                            onClick={() => setDialogCategoryId(category.id)}
                            className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                          >
                            + {pluralize(list.length - VISIBLE_ATHLETES, "atleta", "atletas")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {team && id && programId && athletes && (
        <TeamCategoryAthletesDialog
          eventId={id}
          programId={programId}
          team={team}
          categories={categories}
          athletes={athletes}
          open={dialogCategoryId !== undefined}
          categoryId={dialogCategoryId ?? null}
          onOpenChange={(open) => !open && setDialogCategoryId(undefined)}
          onSaved={load}
          onAthleteCreated={(athlete) => setAthletes((prev) => [...(prev ?? []), athlete])}
        />
      )}

      {id && programId && (
        <EditTeamDialog
          eventId={id}
          programId={programId}
          team={editTeamOpen ? team : null}
          onOpenChange={(open) => !open && setEditTeamOpen(false)}
          onUpdated={load}
        />
      )}

      <ConfirmDialog
        open={removeCategoryTarget !== null}
        onOpenChange={(open) => !open && setRemoveCategoryTarget(null)}
        title="Remover categoria"
        description={`Tirar a equipe ${team?.name} de "${removeCategoryTarget?.name}"? Os atletas marcados nessa categoria também saem dela.`}
        confirmLabel="Remover"
        confirmingLabel="Removendo..."
        onConfirm={handleRemoveCategory}
      />

      <ConfirmDialog
        open={deleteTeamOpen}
        onOpenChange={setDeleteTeamOpen}
        title="Excluir equipe"
        description={`Tem certeza que quer excluir "${team?.name}"? Os atletas continuam cadastrados no programa. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        confirmingLabel="Excluindo..."
        onConfirm={handleDeleteTeam}
      />
    </ProgramsSetupShell>
  );
}

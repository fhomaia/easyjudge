import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CategoryTags } from "@/components/CategoryTags";
import { getAvatarColor } from "@/lib/avatarColor";
import { athleteInitials, athleteName, pluralize } from "@/lib/programAthletes";
import { programAthletesApi, type Program, type ProgramAthlete } from "@/api/client";

export type ProgramOverviewMode = "athletes" | "teams" | "categories";

const TITLES: Record<ProgramOverviewMode, string> = {
  athletes: "Atletas",
  teams: "Equipes",
  categories: "Categorias",
};

// Categorias distintas em que alguma equipe do programa está inscrita,
// cada uma com as equipes dela.
export function programCategories(program: Program) {
  const byId = new Map<string, { id: string; name: string; teams: { id: string; name: string }[] }>();
  for (const team of program.teams ?? []) {
    for (const category of team.categories) {
      const entry = byId.get(category.id) ?? { id: category.id, name: category.name, teams: [] };
      entry.teams.push({ id: team.id, name: team.name });
      byId.set(category.id, entry);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

// Popup só de consulta aberto pelos números da lista de programas
// (ProgramsPage): todas as equipes (com as categorias de cada uma) ou
// todas as categorias (com as equipes de cada uma) ou todos os atletas
// (com as categorias de cada um, buscados ao abrir). Gerenciar continua
// pelo botão "Gerenciar".
export function ProgramOverviewDialog({
  eventId,
  program,
  mode,
  onOpenChange,
}: {
  eventId: string;
  program: Program | null;
  mode: ProgramOverviewMode;
  onOpenChange: (open: boolean) => void;
}) {
  const teams = [...(program?.teams ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const categories = program ? programCategories(program) : [];
  const categoryById = new Map(
    (program?.teams ?? []).flatMap((t) => t.categories.map((c) => [c.id, c] as const)),
  );

  const programId = program?.id ?? null;
  const [athletes, setAthletes] = useState<{ programId: string; list: ProgramAthlete[] } | null>(
    null,
  );
  const [athletesError, setAthletesError] = useState(false);
  useEffect(() => {
    if (mode !== "athletes" || !programId) return;
    let cancelled = false;
    setAthletesError(false);
    programAthletesApi
      .list(eventId, programId)
      .then((list) => !cancelled && setAthletes({ programId, list }))
      .catch(() => !cancelled && setAthletesError(true));
    return () => {
      cancelled = true;
    };
  }, [eventId, programId, mode]);
  const athleteList = athletes && athletes.programId === programId ? athletes.list : null;

  return (
    <Dialog open={program !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto sm:max-w-lg">
        <div className="grid gap-1">
          <DialogTitle>{TITLES[mode]}</DialogTitle>
          <DialogDescription>
            {program?.name} ·{" "}
            {mode === "athletes"
              ? pluralize(athleteList?.length ?? program?.athletesCount ?? 0, "atleta", "atletas")
              : mode === "teams"
                ? pluralize(teams.length, "equipe", "equipes")
                : pluralize(categories.length, "categoria", "categorias")}
          </DialogDescription>
        </div>

        {mode === "athletes" ? (
          athletesError ? (
            <p className="py-4 text-center text-sm text-destructive">
              Não foi possível carregar os atletas.
            </p>
          ) : athleteList === null ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : athleteList.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum atleta cadastrado.
            </p>
          ) : (
            <ul className="grid gap-2">
              {[...athleteList]
                .sort((a, b) => athleteName(a).localeCompare(athleteName(b), "pt-BR"))
                .map((athlete) => {
                  const athleteCategories = [
                    ...new Map(
                      athlete.entries
                        .map((e) => categoryById.get(e.categoryId))
                        .filter((c) => c !== undefined)
                        .map((c) => [c.id, c] as const),
                    ).values(),
                  ];
                  return (
                    <li
                      key={athlete.id}
                      className="flex min-w-0 items-start gap-3 rounded-lg border border-border/60 p-3"
                    >
                      <span
                        style={{ backgroundColor: getAvatarColor(athlete.id) }}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      >
                        {athleteInitials(athlete)}
                      </span>
                      <div className="grid min-w-0 flex-1 gap-1.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {athleteName(athlete)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{athlete.email}</p>
                        </div>
                        <CategoryTags categories={athleteCategories} emptyLabel="Sem categoria" />
                      </div>
                    </li>
                  );
                })}
            </ul>
          )
        ) : mode === "teams" ? (
          teams.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma equipe cadastrada.
            </p>
          ) : (
            <ul className="grid gap-2">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className="flex min-w-0 items-start gap-3 rounded-lg border border-border/60 p-3"
                >
                  <span
                    style={{ backgroundColor: getAvatarColor(team.id) }}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
                  >
                    <Users className="size-3.5" />
                  </span>
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <p className="truncate text-sm font-medium text-foreground">{team.name}</p>
                    <CategoryTags categories={team.categories} />
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : categories.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhuma equipe deste programa está inscrita em categorias.
          </p>
        ) : (
          <ul className="grid gap-2">
            {categories.map((category) => (
              <li key={category.id} className="grid min-w-0 gap-1 rounded-lg border border-border/60 p-3">
                <p className="text-sm font-medium text-foreground">{category.name}</p>
                <p className="text-xs text-muted-foreground">
                  {category.teams
                    .map((t) => t.name)
                    .sort((a, b) => a.localeCompare(b, "pt-BR"))
                    .map((name) => `Equipe ${name}`)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

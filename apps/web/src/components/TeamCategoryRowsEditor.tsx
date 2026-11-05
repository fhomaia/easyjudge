import { AlertTriangle, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pluralize } from "@/lib/programAthletes";
import type { Category, ProgramRegistrationView } from "@/api/client";

export const NEW_TEAM = "__new__";

export type RegistrationTeam = NonNullable<ProgramRegistrationView["program"]>["teams"][number];

export interface TeamCategoryRow {
  categoryId: string;
  // Equipe existente, NEW_TEAM ou "" (ainda não escolhida).
  teamId: string;
  newTeamName: string;
}

// Sugestão: a única equipe do programa já na categoria; sem nenhuma na
// categoria, a única equipe do programa; sem equipes, "Nova equipe".
export function suggestTeam(teams: RegistrationTeam[], categoryId: string): string {
  const inCategory = teams.filter((t) => t.categories.some((c) => c.id === categoryId));
  if (inCategory.length === 1) return inCategory[0].id;
  if (inCategory.length === 0 && teams.length === 1) return teams[0].id;
  return teams.length === 0 ? NEW_TEAM : "";
}

export function rowsIncomplete(rows: TeamCategoryRow[]): boolean {
  return rows.some((r) => !r.teamId || (r.teamId === NEW_TEAM && !r.newTeamName.trim()));
}

// Cria as equipes novas (mesmo nome em duas linhas vira uma equipe só) e
// devolve os pares equipe+categoria.
export async function resolveRows(
  rows: TeamCategoryRow[],
  createTeam: (name: string) => Promise<string>,
): Promise<{ teamId: string; categoryId: string }[]> {
  const created = new Map<string, string>();
  const entries: { teamId: string; categoryId: string }[] = [];
  for (const row of rows) {
    let teamId = row.teamId;
    if (teamId === NEW_TEAM) {
      const name = row.newTeamName.trim();
      const key = name.toLowerCase();
      if (!created.has(key)) created.set(key, await createTeam(name));
      teamId = created.get(key) as string;
    }
    entries.push({ teamId, categoryId: row.categoryId });
  }
  return entries;
}

// Uma linha por categoria, com a equipe; acrescentar/tirar categorias,
// respeitando o limite de categorias por atleta. Usado na aprovação de
// pedido e no "Inscrever atleta".
export function TeamCategoryRowsEditor({
  rows,
  onChange,
  teams,
  categories,
  max,
}: {
  rows: TeamCategoryRow[];
  onChange: (rows: TeamCategoryRow[]) => void;
  teams: RegistrationTeam[];
  categories: Category[];
  max: number | null;
}) {
  const categoryById = (cid: string) => categories.find((c) => c.id === cid);
  const available = categories.filter((c) => !rows.some((r) => r.categoryId === c.id));
  const limitReached = max !== null && rows.length >= max;

  function update(index: number, patch: Partial<TeamCategoryRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="grid gap-3">
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Acrescente ao menos uma categoria.</p>
      )}
      {rows.map((row, index) => (
        <div key={row.categoryId} className="grid gap-2 rounded-lg border border-border/60 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-sm font-medium text-foreground">
              {categoryById(row.categoryId)?.name ?? "Categoria"}
            </p>
            <button
              type="button"
              aria-label="Tirar categoria"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <Select
            value={row.teamId || null}
            onValueChange={(value) => update(index, { teamId: value as string })}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value: string | null) =>
                  !value
                    ? "Escolha a equipe"
                    : value === NEW_TEAM
                      ? "Nova equipe"
                      : (teams.find((t) => t.id === value)?.name ?? "Equipe")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                  {team.categories.some((c) => c.id === row.categoryId) && (
                    <span className="text-xs text-muted-foreground"> (já nesta categoria)</span>
                  )}
                </SelectItem>
              ))}
              <SelectItem value={NEW_TEAM}>
                <Plus className="size-3.5" />
                Nova equipe
              </SelectItem>
            </SelectContent>
          </Select>
          {row.teamId === NEW_TEAM && (
            <Input
              aria-label="Nome da nova equipe"
              placeholder="Nome da nova equipe"
              maxLength={100}
              value={row.newTeamName}
              onChange={(e) => update(index, { newTeamName: e.target.value })}
            />
          )}
        </div>
      ))}

      {available.length > 0 && limitReached && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          O limite de {pluralize(max ?? 0, "categoria", "categorias")} por atleta foi atingido. Para
          acrescentar outra, tire uma das atuais.
        </p>
      )}
      {available.length > 0 && (
        <Select
          disabled={limitReached}
          value={null}
          onValueChange={(value) =>
            value &&
            onChange([
              ...rows,
              { categoryId: value as string, teamId: suggestTeam(teams, value as string), newTeamName: "" },
            ])
          }
        >
          <SelectTrigger className="w-full border-dashed">
            <SelectValue>{() => "+ Acrescentar categoria"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {available.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

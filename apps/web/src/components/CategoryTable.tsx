import { Pencil, Trash2, Users } from "lucide-react";
import { CategoryStatusBadge } from "@/components/CategoryStatusBadge";
import { DIVISION_LABELS, MODALITY_LABELS, formatLabelFor } from "@/lib/categoryLabels";
import { formatMinutesSeconds } from "@/lib/presentationTime";
import type { Category } from "@/api/client";

interface CategoryTableProps {
  categories: Category[];
  teamCounts: Map<string, number>;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onViewTeams: (category: Category) => void;
}

export function CategoryTable({
  categories,
  teamCounts,
  onEdit,
  onDelete,
  onViewTeams,
}: CategoryTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/60 text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Categoria</th>
            <th className="px-4 py-3 font-medium">Modalidade</th>
            <th className="px-4 py-3 font-medium">Divisão</th>
            <th className="px-4 py-3 font-medium">Formato</th>
            <th className="px-4 py-3 font-medium">Nível</th>
            <th className="px-4 py-3 font-medium">Tempo</th>
            <th className="px-4 py-3 font-medium">Sistema de pontuação</th>
            <th className="px-4 py-3 font-medium">Equipes</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr
              key={category.id}
              className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Users className="size-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{category.name}</p>
                    {category.nonTumbling && (
                      <p className="text-xs text-muted-foreground">Non-tumbling</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {MODALITY_LABELS[category.modality]}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {DIVISION_LABELS[category.division]}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatLabelFor(category.categoryFormat, category.customFormatLabel)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">Nível {category.level}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {category.presentationTimeSeconds != null
                  ? formatMinutesSeconds(category.presentationTimeSeconds)
                  : "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {category.scoringTemplate?.name ?? "—"}
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onViewTeams(category)}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  {teamCounts.get(category.id) ?? 0}{" "}
                  {(teamCounts.get(category.id) ?? 0) === 1 ? "equipe" : "equipes"}
                </button>
              </td>
              <td className="px-4 py-3">
                <CategoryStatusBadge status={category.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(category)}
                    aria-label="Editar categoria"
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(category)}
                    aria-label="Excluir categoria"
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

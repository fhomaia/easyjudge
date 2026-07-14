import { Pencil, Trash2, Users } from "lucide-react";
import { CategoryStatusBadge } from "@/components/CategoryStatusBadge";
import { DIVISION_LABELS, MODALITY_LABELS, formatLabelFor } from "@/lib/categoryLabels";
import type { Category } from "@/api/client";

interface CategoryTableProps {
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

export function CategoryTable({ categories, onEdit, onDelete }: CategoryTableProps) {
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

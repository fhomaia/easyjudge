import { motion } from "framer-motion";
import { Calculator, Clock, Pencil, Trash2, Users } from "lucide-react";
import { CategoryStatusBadge } from "@/components/CategoryStatusBadge";
import { listItemVariants } from "@/lib/motionVariants";
import { DIVISION_LABELS, MODALITY_LABELS, formatLabelFor } from "@/lib/categoryLabels";
import { formatMinutesSeconds } from "@/lib/presentationTime";
import type { Category } from "@/api/client";

interface CategoryGridItemProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

export function CategoryGridItem({ category, onEdit, onDelete }: CategoryGridItemProps) {
  return (
    <motion.div
      variants={listItemVariants}
      whileHover={{ y: -2 }}
      className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="size-5" />
        </div>
        <div className="flex items-center gap-1">
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
      </div>

      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{category.name}</p>
        <div className="mt-1.5 flex flex-col gap-1 text-sm text-muted-foreground">
          <span>
            {MODALITY_LABELS[category.modality]} · {DIVISION_LABELS[category.division]}
          </span>
          <span>
            {formatLabelFor(category.categoryFormat, category.customFormatLabel)} · Nível{" "}
            {category.level}
          </span>
          {category.nonTumbling && <span>Non-tumbling</span>}
          {category.presentationTimeSeconds != null && (
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              {formatMinutesSeconds(category.presentationTimeSeconds)}
            </span>
          )}
          {category.scoringTemplate && (
            <span className="flex items-center gap-1.5">
              <Calculator className="size-3.5" />
              {category.scoringTemplate.name}
            </span>
          )}
        </div>
      </div>

      <div className="mt-auto flex pt-1">
        <CategoryStatusBadge status={category.status} />
      </div>
    </motion.div>
  );
}

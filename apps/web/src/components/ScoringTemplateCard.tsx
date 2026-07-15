import { motion } from "framer-motion";
import { Calculator, Settings, Trash2 } from "lucide-react";
import { ScoringTemplateStatusBadge } from "@/components/ScoringTemplateStatusBadge";
import { listItemVariants } from "@/lib/motionVariants";
import { formatDateTime } from "@/lib/formatDate";
import { getAvatarColor } from "@/lib/avatarColor";
import type { ScoringTemplate } from "@/api/client";

interface ScoringTemplateCardProps {
  template: ScoringTemplate;
  onClick: () => void;
  onEdit?: (template: ScoringTemplate) => void;
  onDelete?: (template: ScoringTemplate) => void;
}

export function ScoringTemplateCard({
  template,
  onClick,
  onEdit,
  onDelete,
}: ScoringTemplateCardProps) {
  return (
    <motion.div
      variants={listItemVariants}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            style={{ backgroundColor: getAvatarColor(template.id) }}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-white"
          >
            <Calculator className="size-5" />
          </div>
          <ScoringTemplateStatusBadge isComplete={template.isComplete ?? false} />
        </div>
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(template);
                }}
                aria-label="Editar dados do template"
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Settings className="size-4" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(template);
                }}
                aria-label="Excluir template"
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{template.name}</p>
        {template.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {template.description}
          </p>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between pt-1 text-xs text-muted-foreground">
        <span>{template.criteriaCount ?? 0} critérios</span>
        <span>Atualizado {formatDateTime(template.updatedAt)}</span>
      </div>
    </motion.div>
  );
}

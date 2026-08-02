import { useState } from "react";
import { motion } from "framer-motion";
import { Award, Calculator, Download, FileSpreadsheet, FileText, Lock, Settings, Trash2 } from "lucide-react";
import { ScoringTemplateStatusBadge } from "@/components/ScoringTemplateStatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listItemVariants } from "@/lib/motionVariants";
import { getAvatarColor } from "@/lib/avatarColor";
import { exportScoringTemplateToExcel, exportScoringTemplateToPdf } from "@/lib/scoringTemplateExport";
import { cn } from "@/lib/utils";
import { scoringCriteriaApi, type ScoringTemplate } from "@/api/client";

interface ScoringTemplateCardProps {
  template: ScoringTemplate;
  onClick: () => void;
  onEdit?: (template: ScoringTemplate) => void;
  onDelete?: (template: ScoringTemplate) => void;
  // Pra encaixar em layouts diferentes de grid (ex: linha única com
  // scroll horizontal em ScoringTemplatesListPage, que precisa de
  // largura fixa por card já que flex não estica os itens sozinho).
  className?: string;
}

export function ScoringTemplateCard({
  template,
  onClick,
  onEdit,
  onDelete,
  className,
}: ScoringTemplateCardProps) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload(format: "pdf" | "excel") {
    setDownloading(true);
    try {
      const criteria = await scoringCriteriaApi.list(template.id);
      if (format === "pdf") exportScoringTemplateToPdf(template, criteria);
      else exportScoringTemplateToExcel(template, criteria);
    } catch (err) {
      console.error("Não foi possível gerar a súmula.", err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <motion.div
      variants={listItemVariants}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-primary/30 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div
            style={{ backgroundColor: getAvatarColor(template.id) }}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-white"
          >
            <Calculator className="size-5" />
          </div>
          <ScoringTemplateStatusBadge isComplete={template.isComplete ?? false} />
          {template.isSystemTemplate ? (
            <span
              title={`Modelo oficial${template.source ? `. ${template.source}` : ""}. Não pode ser editado, mas pode ser clonado ao criar um novo template.`}
              className="flex max-w-[180px] items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
            >
              <Award className="size-3 shrink-0" />
              <span className="truncate">{template.source ?? "Modelo oficial"}</span>
            </span>
          ) : null}
          {template.isSystemTemplate && template.year && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {template.year}
            </span>
          )}
          {!template.isSystemTemplate && template.isLocked && (
            <span
              title="Em uso por um evento que já saiu da fase de configuração — não pode ser editado"
              className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
            >
              <Lock className="size-3" />
              Travado
            </span>
          )}
        </div>
        {(onEdit || onDelete) && (
          <div className="flex shrink-0 items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    disabled={downloading}
                    aria-label="Baixar súmula do template"
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  />
                }
              >
                <Download className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => handleDownload("pdf")}>
                  <FileText data-icon="inline-start" />
                  Baixar como PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("excel")}>
                  <FileSpreadsheet data-icon="inline-start" />
                  Baixar como Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!template.isLocked && !template.isSystemTemplate) onEdit(template);
                }}
                disabled={template.isLocked || template.isSystemTemplate}
                aria-label="Editar dados do template"
                title={
                  template.isSystemTemplate
                    ? "Modelo oficial. Não pode ser editado, mas pode ser clonado ao criar um novo template"
                    : template.isLocked
                      ? "Travado — em uso por um evento em andamento"
                      : undefined
                }
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Settings className="size-4" />
              </button>
            )}
            {onDelete && !template.isSystemTemplate && (
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

      <div className="mt-auto pt-1 text-xs text-muted-foreground">
        <span>{template.criteriaCount ?? 0} critérios</span>
      </div>
    </motion.div>
  );
}

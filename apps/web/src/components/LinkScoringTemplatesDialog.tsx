import { useNavigate } from "react-router-dom";
import { ArrowRight, Award } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScoringTemplateStatusBadge } from "@/components/ScoringTemplateStatusBadge";
import type { ScoringTemplate } from "@/api/client";

interface LinkScoringTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ScoringTemplate[];
  selectedIds: Set<string>;
  onToggle: (templateId: string) => void;
}

// Uma linha de checkbox por template — mesmo padrão de
// EditEventStaffRolesDialog (label + Checkbox + descrição), mas aqui a
// marcação já salva na hora (mesmo toggle otimista que
// ScoringTemplatesSummarySection já usava antes desta tela virar um
// popup), sem botão "Salvar" — fechar o popup não desfaz nada.
function TemplateRow({
  template,
  selected,
  onToggle,
}: {
  template: ScoringTemplate;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-start gap-2 rounded-lg border border-border/60 p-3 text-sm transition-colors hover:border-primary/30">
      <Checkbox className="mt-0.5" checked={selected} onCheckedChange={onToggle} />
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-foreground">{template.name}</span>
          <ScoringTemplateStatusBadge isComplete={template.isComplete ?? false} />
          {template.isSystemTemplate && (
            <span
              title={`Modelo oficial${template.source ? `. ${template.source}` : ""}`}
              className="flex max-w-[220px] items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
            >
              <Award className="size-3 shrink-0" />
              <span className="truncate">{template.source ?? "Modelo oficial"}</span>
            </span>
          )}
          {template.isSystemTemplate && template.year && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {template.year}
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {template.criteriaCount ?? 0} critérios
        </span>
      </span>
    </label>
  );
}

export function LinkScoringTemplatesDialog({
  open,
  onOpenChange,
  templates,
  selectedIds,
  onToggle,
}: LinkScoringTemplatesDialogProps) {
  const navigate = useNavigate();
  const myTemplates = templates.filter((t) => !t.isSystemTemplate);
  const systemTemplates = templates.filter((t) => t.isSystemTemplate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-6 p-10 sm:max-w-lg">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Vincular sistema de pontuação</DialogTitle>
          <DialogDescription>
            Marque quais sistemas de pontuação vão ficar disponíveis para as categorias deste
            evento.
          </DialogDescription>
        </div>

        {templates.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Você ainda não tem nenhum sistema de pontuação.
          </p>
        ) : (
          <div className="grid max-h-[50vh] gap-4 overflow-y-auto pr-1">
            {myTemplates.length > 0 && (
              <div className="grid gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Meus sistemas de pontuação
                </h3>
                <div className="grid gap-2">
                  {myTemplates.map((template) => (
                    <TemplateRow
                      key={template.id}
                      template={template}
                      selected={selectedIds.has(template.id)}
                      onToggle={() => onToggle(template.id)}
                    />
                  ))}
                </div>
              </div>
            )}
            {systemTemplates.length > 0 && (
              <div className="grid gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Pré-definidos
                </h3>
                <div className="grid gap-2">
                  {systemTemplates.map((template) => (
                    <TemplateRow
                      key={template.id}
                      template={template}
                      selected={selectedIds.has(template.id)}
                      onToggle={() => onToggle(template.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-2 rounded-lg border border-dashed border-border p-4 text-sm">
          <p className="font-medium text-foreground">Não encontrou um template?</p>
          <p className="text-muted-foreground">
            Crie um novo sistema de pontuação do zero ou a partir de um modelo oficial.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => navigate("/scoring-templates")}
          >
            Ir para Sistemas de Pontuação
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

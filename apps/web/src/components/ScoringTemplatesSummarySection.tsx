import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, Info, Plus } from "lucide-react";
import { ScoringTemplateCard } from "@/components/ScoringTemplateCard";
import { listVariants } from "@/lib/motionVariants";
import { cn } from "@/lib/utils";
import { eventScoringTemplatesApi, type ScoringTemplate } from "@/api/client";

interface ScoringTemplatesSummarySectionProps {
  eventId: string;
  templates: ScoringTemplate[];
}

// Card inteiro clicável pra marcar/desmarcar o template na seleção
// deste evento (a checkbox no canto é só o indicativo visual do
// estado — clicar nela também funciona, mas não é mais o único jeito).
// Não navega pra página do template: essa lista é sobre COMPOR o
// evento, não sobre editar um template específico (quem quiser
// ver/editar o template vai por "Ir para Sistemas de Pontuação").
function SelectableTemplateCard({
  template,
  selected,
  onToggle,
}: {
  template: ScoringTemplate;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative w-80 shrink-0">
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-3 right-3 z-10 flex size-6 items-center justify-center rounded-full border-2 transition-colors",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-transparent",
        )}
      >
        <Check className="size-3.5" />
      </span>
      <ScoringTemplateCard template={template} onClick={onToggle} className="w-80" />
    </div>
  );
}

export function ScoringTemplatesSummarySection({
  eventId,
  templates,
}: ScoringTemplatesSummarySectionProps) {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    eventScoringTemplatesApi
      .list(eventId)
      .then((selected) => setSelectedIds(new Set(selected.map((t) => t.id))))
      .catch(() => setSelectedIds(new Set()));
  }, [eventId]);

  async function toggle(templateId: string) {
    const isSelected = selectedIds?.has(templateId) ?? false;
    // Otimista — a lista de templates em si não muda, só quais estão
    // marcados, então não precisa esperar a resposta pra atualizar a
    // tela (mesmo espírito do resto do app: nota nunca espera round-trip
    // pra aparecer).
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isSelected) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
    try {
      if (isSelected) await eventScoringTemplatesApi.remove(eventId, templateId);
      else await eventScoringTemplatesApi.add(eventId, templateId);
    } catch {
      // Reverte se a chamada falhar.
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (isSelected) next.add(templateId);
        else next.delete(templateId);
        return next;
      });
    }
  }

  const myTemplates = templates.filter((t) => !t.isSystemTemplate);
  const systemTemplates = templates.filter((t) => t.isSystemTemplate);

  function renderRow(list: ScoringTemplate[]) {
    return (
      <div className="overflow-x-auto pb-1">
        <motion.div variants={listVariants} initial="hidden" animate="show" className="flex w-max gap-4">
          {list.map((template) => (
            <SelectableTemplateCard
              key={template.id}
              template={template}
              selected={selectedIds?.has(template.id) ?? false}
              onToggle={() => toggle(template.id)}
            />
          ))}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-lg border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            3. Sistemas de pontuação
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Marque quais sistemas de pontuação serão usados para avaliar as categorias do evento.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/scoring-templates")}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Plus className="size-4" />
          Criar novo template
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum sistema de pontuação criado ainda.
        </p>
      ) : (
        <div className="grid gap-4">
          {myTemplates.length > 0 && (
            <div className="grid gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Meus sistemas de pontuação
              </h3>
              {renderRow(myTemplates)}
            </div>
          )}
          {systemTemplates.length > 0 && (
            <div className="grid gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Pré-definidos
              </h3>
              {renderRow(systemTemplates)}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2.5 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Info className="size-4 shrink-0 text-primary" />
          Só os sistemas marcados aqui aparecem no seletor ao criar/editar uma categoria.
        </span>
        <button
          type="button"
          onClick={() => navigate("/scoring-templates")}
          className="flex items-center justify-end gap-1 self-end font-medium text-primary hover:underline"
        >
          Ir para Sistemas de Pontuação
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

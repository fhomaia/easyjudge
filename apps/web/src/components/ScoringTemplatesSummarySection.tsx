import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Info, Plus } from "lucide-react";
import { ScoringTemplateCard } from "@/components/ScoringTemplateCard";
import { CreateScoringTemplateDialog } from "@/components/CreateScoringTemplateDialog";
import { listVariants } from "@/lib/motionVariants";
import type { ScoringTemplate } from "@/api/client";

interface ScoringTemplatesSummarySectionProps {
  templates: ScoringTemplate[];
  onCreated: (template: ScoringTemplate) => void;
}

export function ScoringTemplatesSummarySection({
  templates,
  onCreated,
}: ScoringTemplatesSummarySectionProps) {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="grid gap-4 rounded-lg border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            3. Sistemas de pontuação
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Os sistemas de pontuação definem como os pontos serão distribuídos nas avaliações.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
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
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {templates.map((template) => (
            <ScoringTemplateCard
              key={template.id}
              template={template}
              onClick={() => navigate(`/scoring-templates/${template.id}`)}
            />
          ))}
        </motion.div>
      )}

      <div className="grid gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2.5 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Info className="size-4 shrink-0 text-primary" />
          Os sistemas de pontuação serão associados às categorias em uma etapa futura.
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

      <CreateScoringTemplateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onCreated}
      />
    </div>
  );
}

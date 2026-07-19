import { useState } from "react";
import { Check, CheckCircle2, PartyPopper, Rocket } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormError";
import { eventsApi, ApiError, type Event } from "@/api/client";

interface PublishEventCardProps {
  event: Event;
  stepNumber: number;
  allStepsCompleted: boolean;
  onPublished: (updatedEvent: Event) => void;
}

// Card de destaque no fim da página de setup — diferente dos outros
// (que abrem uma tela de cadastro), este dispara a publicação de
// verdade (POST /events/:id/publish) e só fica habilitado quando TODAS
// as etapas acima estão concluídas. Visual propositalmente mais
// "comemorativo" (gradiente com as cores da marca) pra destacar que é
// a etapa final — a celebração de verdade (raio + "Prontos para o
// show!") acontece em PublishCelebrationOverlay, disparada pelo
// chamador depois que `onPublished` resolve.
export function PublishEventCard({
  event,
  stepNumber,
  allStepsCompleted,
  onPublished,
}: PublishEventCardProps) {
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyPublished = event.status !== "created";

  async function handlePublish() {
    setError(null);
    setPublishing(true);
    try {
      const updated = await eventsApi.publish(event.id);
      onPublished(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível publicar o evento.");
    } finally {
      setPublishing(false);
    }
  }

  if (alreadyPublished) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white">
          <Check className="size-4" />
        </span>
        <CheckCircle2 className="size-10 text-emerald-600" />
        <h3 className="text-xl font-semibold text-foreground">Evento já publicado!</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          &quot;{event.name}&quot; já está publicado e visível pra quem tem acesso a ele.
        </p>
      </div>
    );
  }

  if (!allStepsCompleted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/40 p-6 text-center">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
          {stepNumber}
        </span>
        <Rocket className="size-10 text-muted-foreground/50" />
        <h3 className="text-xl font-semibold text-muted-foreground">Publicar evento</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Complete todas as etapas acima pra liberar a publicação do evento.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl p-6 text-center shadow-lg"
      style={{
        background: "linear-gradient(135deg, var(--brand-blue), var(--brand-navy) 60%, var(--brand-yellow))",
      }}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white ring-1 ring-white/40">
        {stepNumber}
      </span>
      <PartyPopper className="size-10 text-white" />
      <h3 className="text-xl font-bold text-white drop-shadow-sm">Tudo pronto!</h3>
      <p className="mx-auto max-w-md text-sm text-white/90">
        Todas as etapas foram concluídas — &quot;{event.name}&quot; já pode ser publicado e ficar
        visível pra quem tem acesso a ele.
      </p>

      <FormError message={error} />

      <motion.div
        className="mt-2 inline-block"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        animate={{ y: [0, -4, 0] }}
        transition={{ y: { duration: 1.8, repeat: Infinity, ease: "easeInOut" } }}
      >
        <Button
          size="lg"
          variant="secondary"
          disabled={publishing}
          onClick={handlePublish}
          className="px-8 text-base font-semibold shadow-md"
        >
          <Rocket data-icon="inline-start" />
          {publishing ? "Publicando..." : "Publicar evento"}
        </Button>
      </motion.div>
    </motion.div>
  );
}

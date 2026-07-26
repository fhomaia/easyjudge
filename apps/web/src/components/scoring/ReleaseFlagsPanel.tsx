import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { adminScoringApi, type ReleaseFlags } from "@/api/client";

// Liberação global do evento — "Liberar notas"/"Liberar contestação"/
// "Liberar resultado", um switch só que aplica pra TODAS as
// apresentações de uma vez (antes disso era por apresentação, dentro
// do detalhe de cada uma — mudou a pedido do usuário: o produtor quer
// liberar tudo junto ao fim da competição, não visitar apresentação
// por apresentação). Ligar "Liberar contestação" liga "Liberar notas"
// junto (mesma cascata do backend — EventsService.setReleaseFlags);
// "Liberar resultado" é independente das outras duas.
interface ReleaseFlagsPanelProps {
  eventId: string;
}

export function ReleaseFlagsPanel({ eventId }: ReleaseFlagsPanelProps) {
  const [flags, setFlags] = useState<ReleaseFlags | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminScoringApi.getRelease(eventId).then(setFlags);
  }, [eventId]);

  async function toggle(changes: Parameters<typeof adminScoringApi.setRelease>[1]) {
    setSaving(true);
    const updated = await adminScoringApi.setRelease(eventId, changes);
    setFlags(updated);
    setSaving(false);
  }

  if (!flags) return null;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-start sm:gap-8">
      <label className="flex items-center gap-2 text-sm text-foreground">
        <Switch
          checked={flags.scoresReleased}
          disabled={saving}
          onCheckedChange={(v) => void toggle({ scoresReleased: v === true })}
        />
        Liberar notas para as equipes
      </label>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <Switch
          checked={flags.contestationReleased}
          disabled={saving}
          onCheckedChange={(v) => void toggle({ contestationReleased: v === true })}
        />
        Liberar contestação de notas
      </label>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <Switch
          checked={flags.resultsReleased}
          disabled={saving}
          onCheckedChange={(v) => void toggle({ resultsReleased: v === true })}
        />
        Liberar resultado para as equipes
      </label>
    </div>
  );
}

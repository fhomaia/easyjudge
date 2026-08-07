import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/FormError";
import { SchedulePositionRadioGroup } from "@/components/SchedulePositionRadioGroup";
import { computeResourceTimes, formatMinutes } from "@/lib/scheduleTime";
import { isAutoWaitBreak, scheduleReferenceLabel } from "@/lib/scheduleEntryDisplay";
import type { SchedulePositionType } from "@/lib/useSchedulePosition";
import { ApiError, scheduleApi, type ScheduleDay } from "@/api/client";

type MoveMode = SchedulePositionType;

interface PresentationDetailsDialogProps {
  eventId: string;
  day: ScheduleDay;
  entryId: string | null;
  conflictReasons: string[];
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

// Aberto ao clicar numa apresentação (só apresentação, não aquecimento/
// intervalo/etc.) na linha do tempo da tela de cadastro do cronograma —
// mostra os dados completos dela e junta remover + mover num só lugar,
// como alternativa a arrastar na timeline (útil quando a equipe de
// referência não está visível na tela sem rolar). "Antes de"/"Depois de"
// reaproveitam o mesmo endpoint de mover já usado pelo drag-and-drop
// (scheduleApi.moveEntry) — pedir pra inserir na posição (`order`) da
// apresentação de referência (ou uma casa depois dela) já empurra o
// resto pra frente, sem precisar de um endpoint novo.
export function PresentationDetailsDialog({
  eventId,
  day,
  entryId,
  conflictReasons,
  onOpenChange,
  onChanged,
}: PresentationDetailsDialogProps) {
  const [moveMode, setMoveMode] = useState<MoveMode>("start");
  const [referenceEntryId, setReferenceEntryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMoveMode("start");
    setReferenceEntryId(null);
    setError(null);
  }, [entryId]);

  const times = useMemo(
    () => computeResourceTimes(day.resources, day.startMinutes),
    [day],
  );

  const entry = useMemo(() => {
    if (!entryId) return null;
    for (const resource of day.resources) {
      const found = resource.entries.find((e) => e.id === entryId);
      if (found) return found;
    }
    return null;
  }, [day, entryId]);

  const resource = useMemo(() => {
    if (!entryId) return null;
    return day.resources.find((r) => r.entries.some((e) => e.id === entryId)) ?? null;
  }, [day, entryId]);

  // Candidatas a referência de "antes de"/"depois de": qualquer outro
  // item do dia, em qualquer pista — apresentação ou componente do
  // evento (Almoço, Abertura, Premiação, intervalo personalizado);
  // exclui só aquecimento e os breaks automáticos ("Aguardando
  // aquecimento"/"Aguardando disponibilidade da equipe"), que são
  // geridos pelo backend (pedido do usuário 2026-08-06: antes só
  // listava apresentações). Ordenadas por horário (não por pista), pra
  // listar na ordem em que elas de fato acontecem.
  const otherEntries = useMemo(() => {
    return day.resources
      .flatMap((r) => r.entries.map((e) => ({ entry: e, resource: r })))
      .filter(
        ({ entry: e }) =>
          e.id !== entryId && e.type !== "warmup" && !isAutoWaitBreak(e),
      )
      .sort((a, b) => {
        const ta = times.get(a.entry.id)?.startMinutes ?? 0;
        const tb = times.get(b.entry.id)?.startMinutes ?? 0;
        return ta - tb;
      });
  }, [day, entryId, times]);

  if (!entry || !resource) return null;

  const t = times.get(entry.id);

  async function handleMove() {
    setError(null);
    let targetResourceId: string;
    let order: number;
    if (moveMode === "start") {
      targetResourceId = entry!.resourceId;
      order = 0;
    } else if (moveMode === "end") {
      targetResourceId = entry!.resourceId;
      order = Number.MAX_SAFE_INTEGER;
    } else {
      const ref = otherEntries.find((p) => p.entry.id === referenceEntryId)?.entry;
      if (!ref) {
        setError("Escolha um item de referência.");
        return;
      }
      targetResourceId = ref.resourceId;
      // O backend (movePresentationWithWarmup) remove esta apresentação
      // — e QUALQUER entry vinculada a ela por linkedEntryId, tipo um
      // "Aguardando aquecimento" que sobrou na própria pista — ANTES de
      // reinserir, e só então recalcula a posição de todo mundo que
      // ficou (renumberResource). Ou seja, `ref.order` (lido ANTES
      // dessa remoção) não é diretamente o índice de inserção certo: é
      // o índice entre TODAS as entries da pista (inclui intervalos
      // automáticos, não só apresentações), e pode mudar depois da
      // remoção. Recalcula aqui, do lado do cliente, filtrando a
      // apresentação sendo movida E qualquer entry vinculada a ela —
      // exatamente o que o backend também remove — pra achar o índice
      // real da referência DEPOIS dessa remoção (bug real 2026-08-05,
      // pego testando: "antes de E" jogava a apresentação pro FIM da
      // pista, porque `ref.order` contava intervalos automáticos que
      // não existem mais depois da remoção).
      const excludedIds = new Set<string>([entry!.id]);
      for (const r of day.resources) {
        for (const e of r.entries) {
          if (e.linkedEntryId === entry!.id) excludedIds.add(e.id);
        }
      }
      const targetResource = day.resources.find((r) => r.id === ref.resourceId)!;
      const siblingsAfterRemoval = [...targetResource.entries]
        .sort((a, b) => a.order - b.order)
        .filter((e) => !excludedIds.has(e.id));
      const refIndex = siblingsAfterRemoval.findIndex((e) => e.id === ref.id);
      order = moveMode === "after" ? refIndex + 1 : refIndex;
    }
    setLoading(true);
    try {
      await scheduleApi.moveEntry(eventId, day.id, entry!.id, {
        resourceId: targetResourceId,
        order,
      });
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível mover esta apresentação.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setLoading(true);
    try {
      await scheduleApi.removeEntry(eventId, day.id, entry!.id);
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível remover esta apresentação.");
      setLoading(false);
    }
  }

  return (
    <Dialog open={entryId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="gap-6 p-8 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">
            {entry.teamName ?? "Apresentação"}
          </DialogTitle>
          <DialogDescription>{entry.categoryName}</DialogDescription>
        </div>

        <FormError message={error} />

        <div className="grid gap-2 rounded-lg border border-border/60 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Pista</span>
            <span className="font-medium text-foreground">{resource.name}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Horário</span>
            <span className="font-medium text-foreground">
              {t ? `${formatMinutes(t.startMinutes)} – ${formatMinutes(t.endMinutes)}` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Duração</span>
            <span className="font-medium text-foreground">{entry.durationMinutes} min</span>
          </div>
          {conflictReasons.length > 0 && (
            <p className="mt-1 text-xs text-destructive">
              ⚠ {conflictReasons.join(" · ")}
            </p>
          )}
        </div>

        <div className="grid min-w-0 gap-3">
          <Label>Mover apresentação</Label>
          <SchedulePositionRadioGroup
            value={moveMode}
            onChange={setMoveMode}
            showBeforeAfter={otherEntries.length > 0}
          />

          {(moveMode === "before" || moveMode === "after") && (
            <Select value={referenceEntryId || null} onValueChange={(v) => setReferenceEntryId(v as string)}>
              <SelectTrigger className="w-full min-w-0">
                {/* `placeholder` é ignorado pelo Base UI quando o filho é
                    uma função (ver SelectValue.mjs: só cai no placeholder
                    quando NÃO há children) — por isso o "nada selecionado"
                    precisa ser tratado dentro da própria função, não só
                    via prop `placeholder` (bug real encontrado 2026-08-05,
                    testado no navegador: o trigger renderizava vazio). */}
                <SelectValue className="truncate">
                  {(value: string | null) => {
                    if (!value) return "Escolha o item de referência";
                    const found = otherEntries.find((p) => p.entry.id === value);
                    return found
                      ? `${scheduleReferenceLabel(found.entry)} (${found.resource.name})`
                      : value;
                  }}
                </SelectValue>
              </SelectTrigger>
              {/* alignItemWithTrigger=false: mesmo bug de posicionamento
                  já documentado (CLAUDE.md, "Bug no Select de mês/ano do
                  calendário") — este Select vive dentro do Dialog, não de
                  outro Popover, mas o mesmo cuidado não faz mal aqui. */}
              <SelectContent alignItemWithTrigger={false}>
                {otherEntries.map(({ entry: p, resource: r }) => (
                  <SelectItem key={p.id} value={p.id}>
                    {scheduleReferenceLabel(p)} ({r.name})
                  </SelectItem>
                ))}
                {otherEntries.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">
                    Nenhum outro item agendado neste dia.
                  </p>
                )}
              </SelectContent>
            </Select>
          )}

          <Button onClick={handleMove} disabled={loading} variant="outline" className="w-full">
            {loading ? "Movendo..." : "Mover"}
          </Button>
        </div>

        <Button
          onClick={handleRemove}
          disabled={loading}
          variant="ghost"
          className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 data-icon="inline-start" />
          Remover apresentação
        </Button>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/FormError";
import { SchedulePositionRadioGroup } from "@/components/SchedulePositionRadioGroup";
import { formatDate } from "@/lib/formatDate";
import { isAutoWaitBreak, scheduleReferenceLabel } from "@/lib/scheduleEntryDisplay";
import type { SchedulePositionType } from "@/lib/useSchedulePosition";
import type { FullScheduleItem } from "@/lib/eventFullSchedule";
import { ApiError, type ScheduleDay, type ScheduleEntry } from "@/api/client";

type PositionType = SchedulePositionType;

interface MovePresentationDialogProps {
  item: FullScheduleItem | null;
  day: ScheduleDay | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (resourceId: string, order: number) => Promise<void>;
}

// Só admin/assessor (ver canMove em EventLiveSchedulePage) — mudar a
// pista/ordem de uma apresentação já no cronograma, direto na tela ao
// vivo (2026-07-27, a pedido do usuário: "é comum precisar mudar a
// ordem de apresentação enquanto o evento acontece"). Popup, não
// drag-and-drop — decisão explícita do usuário (mobile-first; arrastar
// é impreciso num evento já em andamento). Só move dentro do MESMO dia
// (o endpoint de mover não suporta trocar de dia).
//
// "Posição" é composta por DOIS selects (2026-07-27, a pedido do
// usuário — o texto combinado "Antes de {equipe} · {categoria}" ficava
// cortado num select só): um pro tipo de posição (início/antes de
// uma/fim) e outro, condicional, pra escolher QUAL apresentação — assim
// o nome da apresentação tem o select inteiro só pra ele, sem dividir
// espaço com "Antes de".
//
// `order` enviado ao backend é um ÍNDICE dentro do array de siblings da
// pista de destino DEPOIS de remover a própria apresentação (e o
// intervalo "Aguardando aquecimento" ligado a ela, se estiver na mesma
// pista) — mesmo algoritmo que
// ScheduleService.movePresentationWithWarmup/createPresentationWithWarmup
// usam de verdade (lido o código do backend antes de implementar isto,
// pra não calcular uma posição errada durante um evento ao vivo). O
// backend nunca rejeita por conflito de horário — sempre absorve
// deslocando aquecimento/intervalos automaticamente — por isso não há
// preview de conflito aqui, só o aviso informativo abaixo do formulário.
export function MovePresentationDialog({
  item,
  day,
  onOpenChange,
  onConfirm,
}: MovePresentationDialogProps) {
  const [resourceId, setResourceId] = useState("");
  const [positionType, setPositionType] = useState<PositionType>("end");
  const [referenceEntryId, setReferenceEntryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presentationResources = useMemo(
    () => (day?.resources ?? []).filter((r) => r.supportsPresentations),
    [day],
  );

  useEffect(() => {
    if (item) {
      setResourceId(item.entry.resourceId);
      setError(null);
    }
  }, [item]);

  const targetResource = presentationResources.find((r) => r.id === resourceId) ?? null;

  // Estado da pista de destino DEPOIS de tirar a própria apresentação
  // (e o intervalo "Aguardando aquecimento" ligado a ela, se estiver
  // nesta mesma pista) — é o que sobra no banco antes do backend
  // reinserir, então os índices calculados aqui batem 1:1 com o `order`
  // que ele espera receber.
  const siblingsAfterRemoval = useMemo(() => {
    if (!targetResource || !item) return [];
    return targetResource.entries
      .filter((e) => e.id !== item.entry.id && e.linkedEntryId !== item.entry.id)
      .slice()
      .sort((a, b) => a.order - b.order);
  }, [targetResource, item]);

  // Qualquer item do cronograma serve de referência (apresentação, ou
  // um componente do evento como Almoço/Abertura/Premiação/intervalo
  // personalizado) — só exclui aquecimento e os breaks automáticos
  // ("Aguardando aquecimento"/"Aguardando disponibilidade da equipe"),
  // que são geridos pelo backend e não fazem sentido como âncora
  // (pedido do usuário 2026-08-06: antes só listava apresentações).
  const anchorEntries = useMemo(
    () =>
      siblingsAfterRemoval
        .map((entry: ScheduleEntry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.type !== "warmup" && !isAutoWaitBreak(entry)),
    [siblingsAfterRemoval],
  );

  // Default: se a pista escolhida ainda é a de origem, pré-seleciona a
  // posição que representa "não mudar nada" (o próximo item do
  // cronograma que já vem depois dela hoje) — sem isso, confirmar sem
  // tocar em nada poderia mover a apresentação pro fim da pista sem
  // querer.
  useEffect(() => {
    if (!item || !targetResource) return;
    if (resourceId === item.entry.resourceId) {
      const currentSiblings = targetResource.entries.slice().sort((a, b) => a.order - b.order);
      const currentIndex = currentSiblings.findIndex((e) => e.id === item.entry.id);
      const next = currentSiblings
        .slice(currentIndex + 1)
        .find(
          (e) =>
            e.type !== "warmup" && !isAutoWaitBreak(e) && e.linkedEntryId !== item.entry.id,
        );
      if (next) {
        setPositionType("before");
        setReferenceEntryId(next.id);
      } else {
        setPositionType("end");
      }
    } else {
      setPositionType("end");
    }
  }, [resourceId, targetResource, item]);

  // Se a pista mudar (ou o item escolhido como referência sumir da
  // lista) enquanto "Antes de"/"Depois de um item do cronograma" está
  // selecionado, cai pra primeira opção disponível em vez de ficar com
  // uma referência inválida.
  useEffect(() => {
    if (positionType !== "before" && positionType !== "after") return;
    if (anchorEntries.some(({ entry }) => entry.id === referenceEntryId)) return;
    setReferenceEntryId(anchorEntries[0]?.entry.id ?? "");
  }, [positionType, anchorEntries, referenceEntryId]);

  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  function computeOrder(): number | null {
    if (positionType === "start") return 0;
    if (positionType === "end") return siblingsAfterRemoval.length;
    const anchor = anchorEntries.find(({ entry }) => entry.id === referenceEntryId);
    if (!anchor) return null;
    return positionType === "before" ? anchor.index : anchor.index + 1;
  }

  async function handleConfirm() {
    const order = computeOrder();
    if (order === null || !resourceId) return;
    setError(null);
    setLoading(true);
    try {
      await onConfirm(resourceId, order);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const canConfirm = computeOrder() !== null && !!resourceId;

  return (
    <Dialog open={item !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-6 p-8 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Mover apresentação</DialogTitle>
          <DialogDescription>
            {item?.entry.teamName ?? "Equipe"}
            {day && ` · ${formatDate(day.date)}`}
          </DialogDescription>
        </div>

        <div className="grid gap-2">
          <Label>Pista</Label>
          <Select value={resourceId} onValueChange={(value) => value && setResourceId(value)}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue className="truncate">
                {(value: string) =>
                  presentationResources.find((r) => r.id === value)?.name ?? "Selecione"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {presentationResources.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3">
          <Label>Posição</Label>
          <SchedulePositionRadioGroup
            value={positionType}
            onChange={setPositionType}
            showBeforeAfter={anchorEntries.length > 0}
          />

          {(positionType === "before" || positionType === "after") && (
            <Select
              value={referenceEntryId || null}
              onValueChange={(value) => setReferenceEntryId(value as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) => {
                    if (!value) return "Escolha o item de referência";
                    const anchor = anchorEntries.find(({ entry }) => entry.id === value);
                    return anchor ? scheduleReferenceLabel(anchor.entry) : value;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {anchorEntries.map(({ entry }) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {scheduleReferenceLabel(entry)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          O aquecimento e os intervalos automáticos são reorganizados sozinhos, se precisar.
        </p>

        <FormError message={error} />

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !canConfirm}>
            {loading ? "Movendo..." : "Mover"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

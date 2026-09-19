import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { COMPONENT_BLOCKS } from "@/components/EventComponentsLibrary";
import { formatMinutes, parseTimeToMinutes } from "@/lib/scheduleTime";
import { newSpecialEventId, wouldCreateCycle } from "@/lib/specialEvents";
import { useIsMobile } from "@/lib/useIsMobile";
import type { SpecialEvent, SpecialEventAnchor } from "@/api/client";

// Eventos especiais da geração automática: todos opcionais. Cada um
// entra em todas as pistas e termina no mesmo horário em todas — a
// duração informada é o tempo mínimo (as pistas que chegam antes
// esperam as outras).
interface SpecialEventsEditorProps {
  value: SpecialEvent[];
  onChange: (value: SpecialEvent[]) => void;
}

const INPUT_BASE =
  "rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground";
// `w-full min-w-0`: no celular o campo nunca pode empurrar a largura do
// modal (select/hora nativos têm largura mínima própria).
const INPUT_CLASS = `${INPUT_BASE} w-full min-w-0`;

// Texto completo no desktop; no celular a coluna é estreita e o select
// cortaria o texto, então usa a versão curta.
const ANCHOR_LABELS: Record<SpecialEventAnchor, string> = {
  time: "Em um horário fixo",
  start: "No início do dia",
  end: "Ao final de todas as apresentações",
  before: "Antes de outro evento especial",
  after: "Depois de outro evento especial",
};
const ANCHOR_LABELS_SHORT: Record<SpecialEventAnchor, string> = {
  time: "Horário fixo",
  start: "No início",
  end: "Ao final",
  before: "Antes de",
  after: "Depois de",
};

// String local (não number direto): apagar o campo pra digitar outro
// valor não pode reexibir "0" na hora (mesmo bug já corrigido no resto
// do diálogo).
function DurationInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  return (
    <input
      type="number"
      min={1}
      value={text}
      aria-label="Duração (min)"
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (Number.isInteger(n) && n >= 1) onChange(n);
      }}
      onBlur={() => setText(String(value))}
      className={`${INPUT_BASE} w-20`}
    />
  );
}

export function SpecialEventsEditor({
  value,
  onChange,
}: SpecialEventsEditorProps) {
  const isMobile = useIsMobile();
  const anchorLabels = isMobile ? ANCHOR_LABELS_SHORT : ANCHOR_LABELS;

  function update(id: string, patch: Partial<SpecialEvent>) {
    onChange(value.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function remove(id: string) {
    // Quem se referia ao removido perde a referência: vira "ao final".
    onChange(
      value
        .filter((e) => e.id !== id)
        .map((e) =>
          e.refId === id ? { ...e, anchor: "end", refId: undefined } : e,
        ),
    );
  }

  function addPreset(label: string) {
    const def = COMPONENT_BLOCKS.find((b) => b.label === label);
    if (!def) return;
    const premiacao = value.find((e) => e.label === "Premiação");
    const base = {
      id: newSpecialEventId(),
      label: def.label,
      type: def.type,
      durationMinutes: def.durationMinutes,
    };
    let event: SpecialEvent;
    if (def.label === "Abertura") event = { ...base, anchor: "start" };
    else if (def.label === "Premiação") event = { ...base, anchor: "end" };
    else if (def.label === "Contestação de notas") {
      event = premiacao
        ? { ...base, anchor: "before", refId: premiacao.id }
        : { ...base, anchor: "end" };
    } else event = { ...base, anchor: "time", timeMinutes: 12 * 60 };
    onChange([...value, event]);
  }

  function addCustom() {
    onChange([
      ...value,
      {
        id: newSpecialEventId(),
        label: "",
        type: "break",
        durationMinutes: 15,
        anchor: "time",
        timeMinutes: 12 * 60,
      },
    ]);
  }

  function setAnchor(event: SpecialEvent, anchor: SpecialEventAnchor) {
    if (anchor === "before" || anchor === "after") {
      const candidate = value.find(
        (o) => o.id !== event.id && !wouldCreateCycle(value, event.id, o.id),
      );
      if (!candidate) return;
      update(event.id, {
        anchor,
        refId: event.refId ?? candidate.id,
        timeMinutes: undefined,
      });
    } else if (anchor === "time") {
      update(event.id, {
        anchor,
        refId: undefined,
        timeMinutes: event.timeMinutes ?? 12 * 60,
      });
    } else {
      update(event.id, { anchor, refId: undefined, timeMinutes: undefined });
    }
  }

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm font-medium">Eventos especiais (opcional)</p>
        <p className="text-xs text-muted-foreground">
          Cada evento entra em todas as pistas e termina no mesmo horário em
          todas. A duração é o tempo mínimo: pistas que chegam antes esperam as
          outras.
        </p>
      </div>

      {value.length === 0 && (
        <p className="rounded-md border border-dashed border-border/60 px-3 py-3 text-sm text-muted-foreground">
          Nenhum evento especial. O cronograma será gerado só com as
          apresentações.
        </p>
      )}

      {value.map((event) => {
        const isCustom = !COMPONENT_BLOCKS.some(
          (b) => b.label === event.label && b.type === event.type,
        );
        const refOptions = value.filter(
          (o) => o.id !== event.id && !wouldCreateCycle(value, event.id, o.id),
        );
        const canBeRelative = refOptions.length > 0;
        return (
          <div
            key={event.id}
            className="grid gap-3 rounded-md border border-border/60 p-3"
          >
            <div className="flex items-end gap-3">
              <div className="grid min-w-0 flex-1 gap-1.5">
                <Label>Evento</Label>
                {isCustom ? (
                  <input
                    type="text"
                    value={event.label}
                    placeholder="Nome do evento"
                    maxLength={100}
                    onChange={(e) =>
                      update(event.id, { label: e.target.value })
                    }
                    className={INPUT_CLASS}
                  />
                ) : (
                  <p className="py-2 text-sm font-medium">{event.label}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mb-0.5 size-8"
                onClick={() => remove(event.id)}
                aria-label={`Remover ${event.label || "evento especial"}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <div className="grid grid-cols-[6rem_1fr] gap-3">
              <div className="grid min-w-0 gap-1.5">
                <Label>Duração (min)</Label>
                <DurationInput
                  value={event.durationMinutes}
                  onChange={(v) => update(event.id, { durationMinutes: v })}
                />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label>Quando</Label>
                <select
                  value={event.anchor}
                  onChange={(e) =>
                    setAnchor(event, e.target.value as SpecialEventAnchor)
                  }
                  className={INPUT_CLASS}
                >
                  {(Object.keys(ANCHOR_LABELS) as SpecialEventAnchor[]).map(
                    (anchor) => (
                      <option
                        key={anchor}
                        value={anchor}
                        disabled={
                          (anchor === "before" || anchor === "after") &&
                          !canBeRelative &&
                          event.anchor !== anchor
                        }
                      >
                        {anchorLabels[anchor]}
                      </option>
                    ),
                  )}
                </select>
              </div>
              {event.anchor === "time" && (
                <div className="col-span-2 grid min-w-0 gap-1.5">
                  <Label>Horário</Label>
                  <input
                    type="time"
                    value={formatMinutes(event.timeMinutes ?? 0)}
                    onChange={(e) => {
                      if (e.target.value)
                        update(event.id, {
                          timeMinutes: parseTimeToMinutes(e.target.value),
                        });
                    }}
                    className={INPUT_CLASS}
                  />
                </div>
              )}
              {(event.anchor === "before" || event.anchor === "after") && (
                <div className="col-span-2 grid min-w-0 gap-1.5">
                  <Label>
                    {event.anchor === "before" ? "Antes de" : "Depois de"}
                  </Label>
                  <select
                    value={event.refId ?? ""}
                    onChange={(e) =>
                      update(event.id, { refId: e.target.value })
                    }
                    className={INPUT_CLASS}
                  >
                    {/* mantém o atual visível mesmo se não estiver mais entre as opções */}
                    {value
                      .filter(
                        (o) =>
                          o.id === event.refId ||
                          refOptions.some((r) => r.id === o.id),
                      )
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label || "Evento sem nome"}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2">
        {COMPONENT_BLOCKS.map((def) => (
          <Button
            key={def.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addPreset(def.label)}
          >
            <Plus className="size-3.5" />
            {def.label}
          </Button>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addCustom}>
          <Plus className="size-3.5" />
          Personalizado
        </Button>
      </div>
    </div>
  );
}

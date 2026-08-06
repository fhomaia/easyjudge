import { ArrowLeftToLine, ArrowRightFromLine, ArrowRightToLine, ArrowUpToLine } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SchedulePositionType } from "@/lib/useSchedulePosition";

interface SchedulePositionRadioGroupProps {
  value: SchedulePositionType;
  onChange: (value: SchedulePositionType) => void;
  // "Antes de"/"Depois de" só fazem sentido quando já existe algum item
  // na pista de destino pra servir de referência.
  showBeforeAfter: boolean;
}

// Estilo com ícone + RadioGroup (em vez de Select) pro campo "Posição" —
// nasceu em PresentationDetailsDialog (mover uma apresentação já
// agendada) e o usuário pediu explicitamente pra reaproveitar aqui
// (2026-08-06, "ficou lindo") nos demais popups que escolhem posição no
// cronograma: MovePresentationDialog, AddUnscheduledEntryDialog e
// AddComponentEntryDialog.
export function SchedulePositionRadioGroup({
  value,
  onChange,
  showBeforeAfter,
}: SchedulePositionRadioGroupProps) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as SchedulePositionType)}>
      <label className="flex items-center gap-2 text-sm">
        <RadioGroupItem value="start" />
        <ArrowUpToLine className="size-4 text-muted-foreground" />
        Para o início da pista
      </label>
      <label className="flex items-center gap-2 text-sm">
        <RadioGroupItem value="end" />
        <ArrowRightToLine className="size-4 text-muted-foreground" />
        Para o fim da pista
      </label>
      {showBeforeAfter && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="before" />
            <ArrowLeftToLine className="size-4 text-muted-foreground" />
            Antes de...
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="after" />
            <ArrowRightFromLine className="size-4 text-muted-foreground" />
            Depois de...
          </label>
        </>
      )}
    </RadioGroup>
  );
}

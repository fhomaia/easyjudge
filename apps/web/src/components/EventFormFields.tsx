import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/DatePicker";

export interface EventFormValues {
  name: string;
  startDate: string;
  location: string;
}

interface EventFormFieldsProps {
  form: EventFormValues;
  onChange: (key: keyof EventFormValues, value: string) => void;
}

// "Dias de competição" saiu do formulário (2026-07-16) — o número de
// dias do evento agora é controlado na tela de Cronograma, através do
// botão "+ Dia" (faz mais sentido lá, já que é onde os dias
// efetivamente existem/são usados).
export function EventFormFields({ form, onChange }: EventFormFieldsProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="event-name">Nome do evento</Label>
        <Input
          id="event-name"
          autoFocus
          value={form.name}
          onChange={(e) => onChange("name", e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="event-start-date">Data de início</Label>
        <DatePicker
          id="event-start-date"
          value={form.startDate}
          onChange={(value) => onChange("startDate", value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="event-location">Local</Label>
        <Input
          id="event-location"
          placeholder="Cidade, UF"
          value={form.location}
          onChange={(e) => onChange("location", e.target.value)}
          required
        />
      </div>
    </>
  );
}

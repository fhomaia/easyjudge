import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/DatePicker";

export interface EventFormValues {
  name: string;
  startDate: string;
  competitionDays: string;
  location: string;
}

interface EventFormFieldsProps {
  form: EventFormValues;
  onChange: (key: keyof EventFormValues, value: string) => void;
}

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

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="event-start-date">Data de início</Label>
          <DatePicker
            id="event-start-date"
            value={form.startDate}
            onChange={(value) => onChange("startDate", value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="event-days">Dias de competição</Label>
          <Input
            id="event-days"
            type="number"
            min={1}
            value={form.competitionDays}
            onChange={(e) => onChange("competitionDays", e.target.value)}
            required
          />
        </div>
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

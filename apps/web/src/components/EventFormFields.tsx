import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/DatePicker";
import { Checkbox } from "@/components/ui/checkbox";

export interface EventFormValues {
  name: string;
  startDate: string;
  location: string;
  venue: string;
  address: string;
  // Data limite da inscrição pelo programa: "" = ainda não escolhida,
  // null = "Sem data limite" marcado.
  registrationDeadline: string | null;
}

interface EventFormFieldsProps {
  form: EventFormValues;
  onChange: <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => void;
  disabled?: boolean;
}

// "yyyy-MM-dd" -> Date local (meia-noite), pro limite do calendário.
function parseDate(value: string): Date | undefined {
  const [y, m, d] = value.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

// Validação comum de criar/editar: devolve a mensagem de erro ou null.
export function registrationDeadlineError(form: EventFormValues): string | null {
  if (form.registrationDeadline === "") {
    return 'Escolha a data limite de inscrição ou marque "Sem data limite".';
  }
  if (form.registrationDeadline !== null && form.registrationDeadline > form.startDate) {
    return "A data limite de inscrição não pode ser depois do início do evento.";
  }
  return null;
}

// "Dias de competição" saiu do formulário (2026-07-16) — o número de
// dias do evento agora é controlado na tela de Cronograma, através do
// botão "+ Dia" (faz mais sentido lá, já que é onde os dias
// efetivamente existem/são usados).
export function EventFormFields({ form, onChange, disabled = false }: EventFormFieldsProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="event-name">Nome do evento</Label>
        <Input
          id="event-name"
          autoFocus
          value={form.name}
          onChange={(e) => onChange("name", e.target.value)}
          disabled={disabled}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="event-start-date">Data de início</Label>
        <DatePicker
          id="event-start-date"
          value={form.startDate}
          onChange={(value) => onChange("startDate", value)}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="event-registration-deadline">Inscrições dos programas até</Label>
        <DatePicker
          id="event-registration-deadline"
          value={form.registrationDeadline ?? ""}
          onChange={(value) => onChange("registrationDeadline", value)}
          maxDate={parseDate(form.startDate)}
          disabled={disabled || form.registrationDeadline === null}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={form.registrationDeadline === null}
            onCheckedChange={(value) => onChange("registrationDeadline", value === true ? null : "")}
            disabled={disabled}
          />
          Sem data limite
        </label>
        <p className="text-xs text-muted-foreground">
          Os programas se inscrevem pelo link ou QR do evento até as 23:59 desse dia.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="event-location">Local</Label>
        <Input
          id="event-location"
          placeholder="Cidade, UF"
          value={form.location}
          onChange={(e) => onChange("location", e.target.value)}
          disabled={disabled}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="event-venue">Nome do local (opcional)</Label>
        <Input
          id="event-venue"
          placeholder="Ex. Expominas"
          value={form.venue}
          onChange={(e) => onChange("venue", e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="event-address">Endereço (opcional)</Label>
        <Input
          id="event-address"
          placeholder="Ex. Av. Amazonas, 6200, Gameleira"
          value={form.address}
          onChange={(e) => onChange("address", e.target.value)}
          maxLength={300}
          disabled={disabled}
        />
      </div>
    </>
  );
}

import { DatePicker } from "@/components/DatePicker";
import { Checkbox } from "@/components/ui/checkbox";

// Data do prazo ou "Sem data limite". value: "" = nada escolhido (data
// vazia e caixa desmarcada), null = sem data limite, senão "yyyy-MM-dd".
export function RegistrationDeadlineFields({
  value,
  onChange,
  startDate,
  disabled = false,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  startDate: string;
  disabled?: boolean;
}) {
  const [y, m, d] = startDate.split("-").map(Number);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="w-full sm:w-56">
        <DatePicker
          value={value ?? ""}
          onChange={(next) => next && onChange(next)}
          maxDate={y && m && d ? new Date(y, m - 1, d) : undefined}
          disabled={value === null || disabled}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox
          checked={value === null}
          disabled={disabled}
          onCheckedChange={(checked) => onChange(checked === true ? null : "")}
        />
        Sem data limite
      </label>
    </div>
  );
}

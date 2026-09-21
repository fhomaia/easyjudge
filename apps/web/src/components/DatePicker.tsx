import { useRef, useState } from "react";
import { format, isValid, parse, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatDateInput } from "@/lib/masks";

interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  // Repassados pro Calendar (react-day-picker) — usados pra datas em
  // range distante do presente (ex. data de nascimento), onde navegar
  // mês a mês pelas setas não é viável. Sem esses props, o comportamento
  // (usado hoje só por datas de evento, sempre perto do presente)
  // continua idêntico ao de antes.
  captionLayout?: "label" | "dropdown";
  startMonth?: Date;
  endMonth?: Date;
  // Bloqueia seleção de datas depois desta (ex. data de nascimento não
  // pode ser no futuro). Nome deliberadamente diferente do `disabled`
  // acima (que desliga o campo inteiro) pra não colidir com o matcher
  // `disabled` do próprio Calendar.
  maxDate?: Date;
}

const DISPLAY_FORMAT = "dd/MM/yyyy";

// Texto digitado completo (dd/mm/aaaa) -> "yyyy-MM-dd", ou null se não
// for uma data real (ex. 31/02) ou cair fora do intervalo permitido.
function parseTyped(
  text: string,
  maxDate?: Date,
  startMonth?: Date,
): string | null {
  const date = parse(text, DISPLAY_FORMAT, new Date());
  if (!isValid(date) || format(date, DISPLAY_FORMAT) !== text) return null;
  if (maxDate && startOfDay(date) > startOfDay(maxDate)) return null;
  if (startMonth && date < startMonth) return null;
  return format(date, "yyyy-MM-dd");
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  disabled = false,
  captionLayout = "label",
  startMonth,
  endMonth,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  // O campo é digitável (máscara dd/mm/aaaa) E abre o calendário pelo
  // ícone. `text` é o que está no input; `value` (ISO) só existe
  // quando o texto é uma data válida. `lastEmitted` distingue mudança
  // vinda daqui de mudança externa (calendário, reset do formulário),
  // que precisa reescrever o texto.
  const [text, setText] = useState(
    selected ? format(selected, DISPLAY_FORMAT) : "",
  );
  const lastEmitted = useRef(value);
  if (value !== lastEmitted.current) {
    lastEmitted.current = value;
    setText(selected ? format(selected, DISPLAY_FORMAT) : "");
  }

  const invalid = text.length === 10 && !value;

  function emit(next: string) {
    lastEmitted.current = next;
    onChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "flex h-12 w-full items-center gap-2.5 rounded-lg border border-transparent bg-muted px-5 text-base text-foreground transition-colors focus-within:border-primary focus-within:bg-primary/[0.06]",
          invalid && "border-destructive focus-within:border-destructive",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <PopoverTrigger
          type="button"
          disabled={disabled}
          aria-label="Abrir calendário"
          className="shrink-0 rounded-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CalendarDays className="size-4" />
        </PopoverTrigger>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          value={text}
          onChange={(e) => {
            const masked = formatDateInput(e.target.value);
            setText(masked);
            const iso = masked.length === 10 ? parseTyped(masked, maxDate, startMonth) : null;
            // Texto incompleto/inválido zera o valor, pro botão
            // "Continuar" (que exige data) travar até ficar correto.
            if (iso !== null) emit(iso);
            else if (value) emit("");
          }}
          className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={ptBR}
          captionLayout={captionLayout}
          startMonth={startMonth}
          endMonth={endMonth}
          disabled={maxDate ? { after: maxDate } : undefined}
          selected={selected}
          // Sem valor selecionado ainda, abre perto do limite (maxDate)
          // em vez do mês atual — sem isso, um `maxDate` muito no
          // passado (ex. 18 anos atrás) abriria o calendário fora do
          // range navegável, exigindo cliques manuais até dar de cara
          // com uma data selecionável.
          defaultMonth={selected ?? maxDate}
          onSelect={(date) => {
            if (!date) return;
            emit(format(date, "yyyy-MM-dd"));
            setText(format(date, DISPLAY_FORMAT));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

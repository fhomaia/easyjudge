import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Selecione uma data",
  disabled = false,
  captionLayout = "label",
  startMonth,
  endMonth,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-12 w-full items-center gap-2.5 rounded-lg border border-transparent bg-muted px-5 text-base text-foreground transition-colors outline-none hover:bg-muted/70 data-[popup-open]:border-primary data-[popup-open]:bg-primary/[0.06] disabled:pointer-events-none disabled:opacity-50",
          !selected && "text-muted-foreground",
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-primary" />
        {selected ? format(selected, "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : placeholder}
      </PopoverTrigger>
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
            onChange(format(date, "yyyy-MM-dd"));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

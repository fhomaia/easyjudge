import type { ReactNode } from "react";
import { Clock, Flame, LayoutGrid } from "lucide-react";
import { ScheduleDayTabs } from "@/components/ScheduleDayTabs";
import { getResourceColor } from "@/lib/resourceColor";
import { formatMinutes, parseTimeToMinutes } from "@/lib/scheduleTime";
import type { ScheduleDay, UpdateScheduleDayPayload } from "@/api/client";

interface ScheduleDaySettingsBarProps {
  days: ScheduleDay[];
  day: ScheduleDay;
  onSelectDay: (dayId: string) => void;
  onAddDay: () => void;
  addingDay: boolean;
  onUpdate: (payload: UpdateScheduleDayPayload) => void;
  onDeleteDay: (dayId: string) => void;
}

function HeaderStat({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-semibold text-foreground">{children}</div>
      </div>
    </div>
  );
}

// Sublinhado tracejado sutil (sempre visível) que vira sólido e muda
// de cor no hover/foco — sem isso, o campo (sem borda nenhuma, só
// texto) não parecia editável de jeito nenhum.
const editableFieldClass =
  "cursor-text border-0 border-b border-dashed border-muted-foreground/40 bg-transparent p-0 text-sm font-semibold text-foreground transition-colors hover:border-primary focus:border-solid focus:border-primary focus:outline-none focus:ring-0";
const timeInputClass = `w-[84px] ${editableFieldClass}`;

// Abas de dia + configurações do dia selecionado juntas na mesma
// barra, no estilo de sub-seções (ícone + rótulo pequeno + valor)
// separadas por divisores verticais — 2026-07-16, a pedido do usuário
// a partir de uma referência visual. Os campos continuam editáveis
// direto (sem precisar de um clique extra num lápis) — só o estilo
// mudou.
//
// A parte de horário/aquecimento usa uma key composta (dia + os 3
// valores editáveis) — os inputs são não-controlados (defaultValue),
// então só remontam (refletindo o valor novo) quando a key muda. Além
// de trocar de dia, isso também cobre o caso de `endMinutes` mudar por
// uma via que não é o próprio input (ex: "Estender horário do dia" no
// popup de conflito de horário, ver SchedulePage.handleExtendDayEnd) —
// sem os valores na key, o input continuaria mostrando o horário
// antigo até trocar de dia e voltar. As abas continuam montadas (não
// remontam ao trocar de dia).
export function ScheduleDaySettingsBar({
  days,
  day,
  onSelectDay,
  onAddDay,
  addingDay,
  onUpdate,
  onDeleteDay,
}: ScheduleDaySettingsBarProps) {
  const sortedResources = [...day.resources].sort((a, b) => a.order - b.order);
  const matCount = sortedResources.filter((r) => r.supportsPresentations).length;

  return (
    <div className="flex flex-wrap items-center justify-around gap-4 rounded-xl border border-border/60 bg-card p-4">
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Dias do evento</p>
        <ScheduleDayTabs
          days={days}
          selectedDayId={day.id}
          onSelect={onSelectDay}
          onAddDay={onAddDay}
          addingDay={addingDay}
          onDeleteDay={onDeleteDay}
        />
      </div>

      <div className="hidden h-10 w-px bg-border sm:block" />

      <div
        key={`${day.id}:${day.startMinutes}:${day.endMinutes}:${day.defaultWarmupMinutes}`}
        className="contents"
      >
        <HeaderStat icon={Clock} label="Horário do dia">
          <div className="flex items-center gap-1">
            <input
              type="time"
              defaultValue={formatMinutes(day.startMinutes)}
              onBlur={(e) => onUpdate({ startMinutes: parseTimeToMinutes(e.target.value) })}
              className={timeInputClass}
            />
            <span className="text-muted-foreground">–</span>
            <input
              type="time"
              defaultValue={formatMinutes(day.endMinutes)}
              onBlur={(e) => onUpdate({ endMinutes: parseTimeToMinutes(e.target.value) })}
              className={timeInputClass}
            />
          </div>
        </HeaderStat>

        <div className="hidden h-10 w-px bg-border sm:block" />

        <HeaderStat icon={Flame} label="Tempo de aquecimento">
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              defaultValue={day.defaultWarmupMinutes}
              onBlur={(e) => onUpdate({ defaultWarmupMinutes: Number(e.target.value) })}
              className={`w-10 ${editableFieldClass}`}
            />
            <span>min</span>
          </div>
        </HeaderStat>
      </div>

      <div className="hidden h-10 w-px bg-border sm:block" />

      <HeaderStat icon={LayoutGrid} label="Recursos (pistas)">
        {matCount} {matCount === 1 ? "pista" : "pistas"}
      </HeaderStat>

      {sortedResources.length > 0 && (
        <>
          <div className="hidden h-10 w-px bg-border sm:block" />
          <div className="flex flex-col gap-1">
            {sortedResources.map((resource) => (
              <div key={resource.id} className="flex items-center gap-1.5 text-xs">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: getResourceColor(resource) }}
                />
                <span className="text-muted-foreground">{resource.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

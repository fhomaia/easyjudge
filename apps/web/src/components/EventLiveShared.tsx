import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Clock,
  Flame,
  History,
  Home,
  MoreHorizontal,
  PartyPopper,
  Trophy,
  Users,
} from "lucide-react";
import { getScheduleEntryDisplay } from "@/lib/scheduleEntryDisplay";
import type { LiveScheduleItem } from "@/lib/eventLiveSchedule";
import { cn } from "@/lib/utils";
import type { ScheduleEntryType } from "@/api/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Ícone/cor por tipo de componente do cronograma — mesma paleta usada no
// construtor de cronograma (SCHEDULE_TYPE_STYLES em scheduleEntryDisplay),
// só adaptada pra um box de ícone em vez de um card da timeline.
export const ENTRY_VISUALS: Record<ScheduleEntryType, { icon: typeof Users; className: string }> = {
  presentation: { icon: Users, className: "bg-violet-500/10 text-violet-600" },
  warmup: { icon: Flame, className: "bg-emerald-500/10 text-emerald-600" },
  break: { icon: Clock, className: "bg-orange-500/10 text-orange-600" },
  ceremony: { icon: PartyPopper, className: "bg-purple-500/10 text-purple-600" },
  award: { icon: Trophy, className: "bg-teal-500/10 text-teal-600" },
};

export function scheduleItemTitleParts(item: LiveScheduleItem): { title: string; subtitle: string | null } {
  const display = getScheduleEntryDisplay(item.entry, item.start, item.end, []);
  return { title: display.title, subtitle: display.subtitle };
}

// Alertas ainda não têm módulo próprio no backend (sem check-in nem
// tracking de "nota não lançada") — mockado a pedido do usuário até essa
// parte existir.
export const MOCK_ALERTS = [
  {
    id: "1",
    title: "Maria Silva ainda não lançou as notas",
    subtitle: "Building • Pyramid • Tumbling",
  },
  {
    id: "2",
    title: "Check-in pendente: 1 equipe",
    subtitle: "Black Panthers (Senior Coed Elite)",
  },
];

// Abas "NESTE EVENTO" — reaproveitadas pelo menu lateral de desktop
// (AppSidebar), pelo drawer mobile (MobileNavSheet) e pelo menu inferior
// mobile de EventLiveDashboardPage. Só "Início" e "Cronograma" têm tela
// de verdade hoje — Resultados/Notas/Alertas/Histórico continuam
// placeholder (sem onClick, ficam desabilitadas) até ganharem sua
// própria página. "Notas" é onde o jurado vai lançar nota por
// apresentação (e a equipe vai ver a própria nota) quando esse módulo
// existir — hoje só reserva o lugar no menu.
export interface EventNavTab {
  key: string;
  label: string;
  icon: typeof Home;
  current?: boolean;
  badge?: number;
  onClick?: () => void;
}

// Chaves condensadas no botão "Mais" do menu inferior mobile (ver
// `EventLiveBottomNav`) — Alertas e Histórico ainda são só placeholder,
// não justificam um ícone próprio na barra principal do menu; no
// menu lateral/drawer (que têm espaço de sobra) continuam abas
// separadas, isso só reduz a barra inferior.
const BOTTOM_NAV_OVERFLOW_KEYS = ["alertas", "historico"];

export function buildEventNavTabs(opts: {
  current: "inicio" | "cronograma" | "resultados" | "notas" | "alertas" | "historico";
  onNavigateHome: () => void;
  onNavigateSchedule: () => void;
}): EventNavTab[] {
  return [
    { key: "inicio", label: "Início", icon: Home, current: opts.current === "inicio", onClick: opts.onNavigateHome },
    {
      key: "cronograma",
      label: "Cronograma",
      icon: CalendarDays,
      current: opts.current === "cronograma",
      onClick: opts.onNavigateSchedule,
    },
    { key: "resultados", label: "Resultados", icon: Trophy, current: opts.current === "resultados" },
    { key: "notas", label: "Notas", icon: ClipboardList, current: opts.current === "notas" },
    {
      key: "alertas",
      label: "Alertas",
      icon: AlertTriangle,
      current: opts.current === "alertas",
      badge: MOCK_ALERTS.length,
    },
    { key: "historico", label: "Histórico", icon: History, current: opts.current === "historico" },
  ];
}

// Menu inferior mobile — ver comentário em `EventNavTab` acima.
// Extraído daqui pra ser reaproveitado por qualquer tela da jornada ao
// vivo que precise dele em mobile (hoje: EventLiveDashboardPage e
// EventLiveSchedulePage), não só um JSX solto dentro da Dashboard.
// Abas cuja `key` está em `overflowKeys` não viram botão próprio —
// entram num único botão "Mais" (⋯) com um menu suspenso, pra barra
// não crescer sem limite conforme mais seções (hoje só placeholder)
// forem entrando.
export function EventLiveBottomNav({
  tabs,
  overflowKeys = BOTTOM_NAV_OVERFLOW_KEYS,
  className,
}: {
  tabs: EventNavTab[];
  overflowKeys?: string[];
  className?: string;
}) {
  const primaryTabs = tabs.filter((tab) => !overflowKeys.includes(tab.key));
  const overflowTabs = tabs.filter((tab) => overflowKeys.includes(tab.key));
  const overflowBadge = overflowTabs.reduce((sum, tab) => sum + (tab.badge ?? 0), 0);
  const overflowCurrent = overflowTabs.some((tab) => tab.current);

  return (
    <nav
      className={cn(
        "flex items-center border-t border-border bg-card px-2 py-2",
        className,
      )}
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      {primaryTabs.map(({ key, label, icon: Icon, current, badge, onClick }) => (
        <button
          key={key}
          type="button"
          disabled={!onClick}
          onClick={onClick}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium",
            current ? "text-primary" : onClick ? "text-foreground/70" : "text-muted-foreground/60",
          )}
        >
          <span className="relative">
            <Icon className="size-5" />
            {badge ? (
              <span className="absolute -top-1 -right-1.5 flex size-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white">
                {badge}
              </span>
            ) : null}
          </span>
          {label}
        </button>
      ))}

      {overflowTabs.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium",
                  overflowCurrent ? "text-primary" : "text-foreground/70",
                )}
              />
            }
          >
            <span className="relative">
              <MoreHorizontal className="size-5" />
              {overflowBadge ? (
                <span className="absolute -top-1 -right-1.5 flex size-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white">
                  {overflowBadge}
                </span>
              ) : null}
            </span>
            Mais
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end">
            {overflowTabs.map(({ key, label, icon: Icon, badge, onClick }) => (
              <DropdownMenuItem key={key} disabled={!onClick} onClick={onClick}>
                <Icon data-icon="inline-start" />
                {label}
                {badge ? (
                  <span className="ml-auto flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
                    {badge}
                  </span>
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  );
}

export function countdownLabel(startMinutes: number, nowMinutes: number): string {
  const diff = Math.round(startMinutes - nowMinutes);
  if (diff <= 0) return "Ao vivo";
  return `Em ${diff} min`;
}

export function StatTile({
  icon: Icon,
  iconClassName,
  barClassName,
  value,
  label,
  progress,
  onClick,
}: {
  icon: typeof CalendarDays;
  iconClassName: string;
  barClassName?: string;
  value: string;
  label: string;
  progress?: number;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2.5">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", iconClassName)}>
          <Icon className="size-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-lg leading-tight font-bold text-foreground">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", barClassName)}
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>
      )}
    </>
  );

  const className = cn(
    "w-full rounded-xl border border-border bg-card p-3.5 text-left",
    onClick && "cursor-pointer transition-colors hover:border-primary/30 hover:bg-primary/5",
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

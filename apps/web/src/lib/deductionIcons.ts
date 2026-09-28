import {
  AlertTriangle,
  Ban,
  Clock,
  Flag,
  Layers,
  MoveDiagonal,
  TrendingDown,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { DeductionType } from "@/api/client";

// Ícone por tipo de dedução (grid de toque rápido do bloco Legalidade)
// — puramente visual, os rótulos oficiais ficam em lib/deductionLabels.ts.
export const DEDUCTION_ICONS: Record<DeductionType, LucideIcon> = {
  athlete_fall: Users,
  major_athlete_fall: Users,
  building_bobble: Layers,
  building_fall: Layers,
  major_building_fall: Layers,
  legality_infractions: Ban,
  skill_out_of_level: TrendingDown,
  time_limit_violations: Clock,
  boundary_violations: MoveDiagonal,
  warning: AlertTriangle,
};

// "Warning" (2026-09-28): último botão do painel de legalidade de todo
// sistema (a API acrescenta, ver WARNING_DEDUCTION no backend). Vale 0
// e não conta pro Hit Zero.
export const WARNING_DEDUCTION_TYPE = "warning";

export const DEDUCTION_FALLBACK_ICON: LucideIcon = AlertTriangle;
export const DEDUCTION_LOG_ICON: LucideIcon = Flag;

// "01:15" — mm:ss, relativo ao início cronometrado da apresentação.
// Precisão máxima de segundos (antes ia até décimo — o usuário achou
// precisão maior que isso desnecessária pra marcar quando uma dedução
// ocorreu).
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.round(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Inverso de formatElapsed. Aceita "MM:SS" e também o que é fácil de
// digitar no celular (2026-09-28, jurada não conseguia editar o tempo):
// "1:30", "1.30", "1,30", "1 30" ou só dígitos ("130" = 1:30, "45" =
// 0:45; os dois últimos dígitos são os segundos). `null` se não der pra
// entender ou os segundos passarem de 59.
export function parseElapsed(text: string): number | null {
  const trimmed = text.trim();
  let minutes: number;
  let seconds: number;
  const separated = /^(\d{1,3})\s*[:.,\s]\s*(\d{1,2})$/.exec(trimmed);
  if (separated) {
    minutes = Number(separated[1]);
    seconds = Number(separated[2]);
  } else if (/^\d{1,5}$/.test(trimmed)) {
    const digits = Number(trimmed);
    minutes = Math.floor(digits / 100);
    seconds = digits % 100;
  } else {
    return null;
  }
  if (seconds > 59) return null;
  return minutes * 60_000 + seconds * 1000;
}

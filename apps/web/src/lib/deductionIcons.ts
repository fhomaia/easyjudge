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
};

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

// Inverso de formatElapsed — aceita só "MM:SS". `null` se o texto não
// bater no formato ou os segundos passarem de 59.
export function parseElapsed(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (seconds > 59) return null;
  return minutes * 60_000 + seconds * 1000;
}

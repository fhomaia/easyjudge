import type { Category, CategoryFormat } from "@/api/client";
import { FORMAT_LABELS } from "@/lib/categoryLabels";

// Mesma regra do backend (autoFormatKey em auto-generate-order.enum.ts):
// formato fixo usa o próprio valor; cada Custom vale pelo nome
// (`custom:<rótulo>`).
export function autoFormatKey(format: CategoryFormat, customFormatLabel?: string | null): string {
  const label = customFormatLabel?.trim();
  return format === "custom" && label ? `custom:${label}` : format;
}

export function autoFormatKeyLabel(key: string): string {
  if (key.startsWith("custom:")) return key.slice("custom:".length);
  return FORMAT_LABELS[key as CategoryFormat] ?? key;
}

const DEFAULT_FORMAT_ORDER: CategoryFormat[] = [
  "team_cheer",
  "group_stunt",
  "coed",
  "partner",
  "custom",
];

// Formatos que existem nas categorias do evento, na ordem padrão (e
// Customs por nome, depois dos fixos).
export function eventFormatKeysInDefaultOrder(categories: Category[]): string[] {
  const keys = new Set(categories.map((c) => autoFormatKey(c.categoryFormat, c.customFormatLabel)));
  const rank = (key: string) => {
    const base = key.startsWith("custom:") ? "custom" : (key as CategoryFormat);
    return DEFAULT_FORMAT_ORDER.indexOf(base);
  };
  return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "pt-BR"));
}

// Ordem salva do dia restrita ao que existe no evento; o que ainda não
// foi ordenado pelo usuário entra no fim, na ordem padrão.
export function mergeSavedFormatOrder(saved: string[], categories: Category[]): string[] {
  const inEvent = eventFormatKeysInDefaultOrder(categories);
  const present = new Set(inEvent);
  const kept = saved.filter((key) => present.has(key));
  return [...kept, ...inEvent.filter((key) => !kept.includes(key))];
}

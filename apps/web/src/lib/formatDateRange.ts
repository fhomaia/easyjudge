import { addDays, parseISO } from "date-fns";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

// "12 de Setembro" (1 dia) / "12 e 13 de Setembro" (2 dias, mesmo mês) /
// "12 a 14 de Setembro" (3+ dias, mesmo mês) / "30 de Setembro a 2 de
// Outubro" (atravessa o mês).
export function formatEventDateRange(startDate: string, competitionDays: number): string {
  const start = parseISO(startDate);
  if (competitionDays <= 1) {
    return `${start.getDate()} de ${MONTH_NAMES[start.getMonth()]}`;
  }

  const end = addDays(start, competitionDays - 1);
  const connector = competitionDays === 2 ? "e" : "a";

  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} ${connector} ${end.getDate()} de ${MONTH_NAMES[start.getMonth()]}`;
  }
  return `${start.getDate()} de ${MONTH_NAMES[start.getMonth()]} ${connector} ${end.getDate()} de ${MONTH_NAMES[end.getMonth()]}`;
}

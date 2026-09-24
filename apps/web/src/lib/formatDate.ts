export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export function formatDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  const datePart = date.toLocaleDateString("pt-BR");
  const timePart = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} às ${timePart}`;
}

// Rótulo curto de aba por dia ("Sáb, 26/09"). Meio-dia evita o dia
// "voltar" um por causa do fuso ao interpretar uma data sem horário.
export function formatDayTab(isoDate: string): string {
  const weekday = new Date(`${isoDate}T12:00:00`)
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "");
  const [, month, day] = isoDate.split("-");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day}/${month}`;
}

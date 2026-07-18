// Soma dias a uma data no formato 'yyyy-MM-dd' sem depender de fuso
// horário local — evita o bug de `new Date('yyyy-MM-dd')` (UTC
// midnight) + `setDate` (fuso local) deslocar um dia conforme o fuso
// do servidor.
export function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

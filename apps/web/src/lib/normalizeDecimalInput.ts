// Aceita vírgula (comum em teclado numérico/locale pt-BR) mas
// normaliza pra ponto — o valor salvo (e exibido) sempre usa ponto
// como separador decimal, nunca vírgula.
export function normalizeDecimalInput(raw: string): string {
  const withDot = raw.replace(",", ".");
  const sanitized = withDot.replace(/[^0-9.]/g, "");
  const firstDot = sanitized.indexOf(".");
  if (firstDot === -1) return sanitized;
  return (
    sanitized.slice(0, firstDot + 1) + sanitized.slice(firstDot + 1).replace(/\./g, "")
  );
}

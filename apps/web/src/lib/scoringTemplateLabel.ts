// Nome de exibição de um sistema de pontuação: modelos oficiais ganham a
// fonte ao lado do nome, porque fontes diferentes podem ter modelos com o
// mesmo nome (ex. "Team Cheer (Coed) — Non-Tumbling" da IASF e da United
// Scoring System) e, só pelo nome, não dá pra saber qual está em uso. Usa
// a sigla entre parênteses quando a fonte tem uma ("International All
// Star Federation (IASF)" vira "IASF") ou, sem sigla, as iniciais de um
// nome com 3+ palavras ("United Scoring System" vira "USS"), pra caber
// em seletor e tabela.
export function scoringTemplateLabel(template: {
  name: string;
  isSystemTemplate?: boolean;
  source?: string | null;
}): string {
  if (!template.isSystemTemplate || !template.source) return template.name;
  const words = template.source.trim().split(/\s+/);
  const acronym =
    template.source.match(/\(([^)]+)\)\s*$/)?.[1] ??
    (words.length >= 3 ? words.map((w) => w[0].toUpperCase()).join("") : null);
  return `${template.name} · ${acronym ?? template.source}`;
}

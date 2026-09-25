// Nome de exibição de um sistema de pontuação: modelos oficiais ganham a
// fonte ao lado do nome, porque fontes diferentes podem ter modelos com o
// mesmo nome (ex. "Team Cheer (Coed) — Non-Tumbling" da IASF e da United
// Scoring System) e, só pelo nome, não dá pra saber qual está em uso.
export function scoringTemplateLabel(template: {
  name: string;
  isSystemTemplate?: boolean;
  source?: string | null;
}): string {
  return template.isSystemTemplate && template.source ? `${template.name} · ${template.source}` : template.name;
}

import type { ScoreBand, ScoringCriterion } from "@/api/client";

// Mesma regra validada no backend (ScoringCriteriaService.
// assertBandsCoverMaxScore) — duplicada aqui só pra dar feedback
// imediato no builder, sem round-trip; a fonte de verdade continua
// sendo o backend (que rejeita com 409 se, por algum motivo, um
// payload inválido chegar até ele). Sobreposição entre faixas é
// permitida de propósito — só falta de cobertura (vão) é erro.
export function validateScoreBands(bands: ScoreBand[], maxScore: number): string | null {
  if (bands.length === 0) return "Adicione ao menos uma faixa de pontuação.";

  for (const band of bands) {
    if (!band.name.trim()) return "Toda faixa precisa de um nome.";
    if (band.min >= band.max) return "Em toda faixa, o início precisa ser menor que o fim.";
  }

  // Sweep pelas faixas ordenadas por início, acumulando até onde a
  // cobertura já chega — sobreposição só estende/mantém `covered`, só
  // um vão (próxima faixa começando depois de `covered`) é erro.
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  if (sorted[0].min > 0) return "As faixas precisam cobrir a partir de 0.";

  let covered = sorted[0].max;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min > covered) {
      return "Existe um intervalo de pontuação sem nenhuma faixa correspondente.";
    }
    covered = Math.max(covered, sorted[i].max);
  }

  if (covered < maxScore) {
    return `As faixas precisam cobrir até ${maxScore} (a pontuação máxima do critério).`;
  }

  return null;
}

// Verdadeiro se algum critério do template tem faixas salvas que não
// cobrem mais a `maxScore` atual (mesma checagem do backend, ver
// ScoringTemplatesService.hasStaleScoreBands) — mudar a pontuação
// máxima de um critério não revalida as faixas automaticamente (evita
// travar o autosave por-campo), então isso pode ficar desalinhado até
// alguém revisitar o critério. Usado pro banner de aviso no builder.
export function hasStaleScoreBands(criteria: ScoringCriterion[]): boolean {
  return criteria.some(
    (c) => c.useScoreBands && !!c.scoreBands && c.scoreBands.length > 0 && validateScoreBands(c.scoreBands, c.maxScore) !== null,
  );
}

// Qual faixa "vale" pra uma nota — usado na tela do jurado (nome/cor da
// faixa atual, embaixo de "Nota máxima"). Faixas podem se sobrepor (ver
// validateScoreBands); em caso de sobreposição, a de início mais baixo
// vence — mesmo critério de desempate usado em buildBandGradient, pra
// as duas leituras (rótulo e cor do trilho do slider) sempre baterem.
export function findMatchingBand(bands: ScoreBand[], score: number): ScoreBand | null {
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  return sorted.find((band) => score >= band.min && score <= band.max) ?? null;
}

// Gradiente CSS (hard-stops, sem transição de cor) representando as
// faixas ao longo de [0, maxScore] — usado no trilho do ScoreBandSlider.
// Calcula os pontos de corte reais (todo min/max de toda faixa) em vez
// de só usar os limites de cada faixa isoladamente, porque em trechos
// de sobreposição a faixa "vencedora" (ver findMatchingBand) pode mudar
// no meio do intervalo de uma faixa perdedora.
export function buildBandGradient(bands: ScoreBand[], maxScore: number): string {
  if (bands.length === 0 || maxScore <= 0) return "";

  const boundaries = new Set<number>([0, maxScore]);
  for (const band of bands) {
    boundaries.add(Math.max(0, Math.min(band.min, maxScore)));
    boundaries.add(Math.max(0, Math.min(band.max, maxScore)));
  }
  const sorted = Array.from(boundaries).sort((a, b) => a - b);

  const stops: string[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (end <= start) continue;
    const winner = findMatchingBand(bands, (start + end) / 2);
    const color = winner?.color ?? "var(--color-muted)";
    const startPct = (start / maxScore) * 100;
    const endPct = (end / maxScore) * 100;
    stops.push(`${color} ${startPct}% ${endPct}%`);
  }

  return stops.length > 0 ? `linear-gradient(to right, ${stops.join(", ")})` : "";
}

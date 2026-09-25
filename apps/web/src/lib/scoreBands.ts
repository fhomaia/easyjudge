import type { FixedScoreValue, ScoreBand, ScoringCriterion, ScoringCriterionView } from "@/api/client";

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
//
// `highlightBand`, quando passado, faz só o trecho da faixa ATUAL (a
// que o ponteiro está) ganhar cor — o resto do trilho fica neutro
// (pedido do usuário, 2026-09-19: colorir tudo sempre distraía mais do
// que ajudava). Comparação por referência: `winner` vem da mesma
// `bands` que gerou `highlightBand` (ver ScoreBandSlider), então é o
// mesmo objeto quando é a mesma faixa, mesmo com sobreposição.
export function buildBandGradient(
  bands: ScoreBand[],
  maxScore: number,
  highlightBand?: ScoreBand | null,
): string {
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
    const highlighted = highlightBand === undefined || winner === highlightBand;
    const color = winner && highlighted ? winner.color : "var(--color-muted)";
    const startPct = (start / maxScore) * 100;
    const endPct = (end / maxScore) * 100;
    stops.push(`${color} ${startPct}% ${endPct}%`);
  }

  return stops.length > 0 ? `linear-gradient(to right, ${stops.join(", ")})` : "";
}

// Mesma regra de ScoringCriteriaService.assertFixedValuesValid (backend),
// só pra feedback imediato no builder.
export function validateFixedValues(values: FixedScoreValue[], maxScore: number): string | null {
  if (values.length < 2) return "Adicione ao menos dois valores.";
  const seen = new Set<number>();
  for (const item of values) {
    if (!item.name.trim()) return "Todo valor precisa de um nome.";
    if (item.value < 0 || item.value > maxScore) {
      return `Os valores precisam ficar entre 0 e ${maxScore} (a pontuação máxima do critério).`;
    }
    if (Math.abs(item.value * 10 - Math.round(item.value * 10)) > 1e-9) {
      return "Os valores podem ter no máximo 1 casa decimal.";
    }
    if (seen.has(item.value)) return `O valor ${item.value} aparece mais de uma vez.`;
    seen.add(item.value);
  }
  return null;
}

// Algum valor fixo salvo acima da pontuação máxima atual (mesma ideia
// de hasStaleScoreBands).
export function hasStaleFixedValues(criteria: ScoringCriterion[]): boolean {
  return criteria.some((c) => c.useFixedValues && (c.fixedValues ?? []).some((v) => v.value > c.maxScore));
}

// Valor fixo que corresponde exatamente à nota (a média de mais de um
// jurado pode não bater com nenhum, e aí não há valor a mostrar).
export function findFixedValue(values: FixedScoreValue[], score: number): FixedScoreValue | null {
  return values.find((v) => Math.abs(v.value - score) < 1e-6) ?? null;
}

// Cor neutra usada quando um valor fixo aparece no lugar de uma faixa
// (valores fixos não têm cor própria).
export const FIXED_VALUE_COLOR = "#475569";

// Faixa (ou valor fixo, apresentado como faixa) em que uma nota caiu —
// usado na súmula (tela e PDF). Null sem nota ou sem faixas/valores.
export function criterionBandForScore(
  criterion: Pick<ScoringCriterionView, "useScoreBands" | "scoreBands" | "useFixedValues" | "fixedValues">,
  score: number | null,
): ScoreBand | null {
  if (score === null) return null;
  if (criterion.useFixedValues && criterion.fixedValues?.length) {
    const match = findFixedValue(criterion.fixedValues, score);
    if (!match) return null;
    return { name: match.name, description: match.description, color: FIXED_VALUE_COLOR, min: match.value, max: match.value };
  }
  if (criterion.useScoreBands && criterion.scoreBands?.length) {
    return findMatchingBand(criterion.scoreBands, score);
  }
  return null;
}

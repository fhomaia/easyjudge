// Paleta de cores vivas pra fundo de avatares sem foto (programas,
// templates de pontuação, equipes, ...). A cor é determinística (hash
// do id/nome) — o mesmo item sempre cai na mesma cor, só "parece
// aleatória" entre itens diferentes; não muda a cada re-render/reload.
export const VIBRANT_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
  "#ec4899", // pink
];

// Paleta mais suave (um tom mais claro que VIBRANT_COLORS, mesma
// família de matiz) — usada só pra faixa de pontuação (ScoreBandsEditor,
// ver ScoringCriterion.scoreBands). A cor de uma faixa é lida direto
// como cor de TEXTO (nome da faixa) e preenchimento do trilho/polegar
// do slider na súmula do jurado — algo que fica na tela o tempo todo
// durante o julgamento, então mais saturado cansa a vista (pedido do
// usuário, 2026-08-02). VIBRANT_COLORS continua igual pra avatar/pista
// de cronograma, onde o contraste forte ajuda a escanear rápido.
export const PASTEL_BAND_COLORS = [
  "#f87171", // red-400
  "#fb923c", // orange-400
  "#fbbf24", // amber-400
  "#4ade80", // green-400
  "#34d399", // emerald-400
  "#2dd4bf", // teal-400
  "#38bdf8", // sky-400
  "#60a5fa", // blue-400
  "#818cf8", // indigo-400
  "#a78bfa", // violet-400
  "#e879f9", // fuchsia-400
  "#f472b6", // pink-400
];

export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return VIBRANT_COLORS[Math.abs(hash) % VIBRANT_COLORS.length];
}

// Ordem "espalhada" dos 13 tons de VIBRANT_COLORS, andando sempre ~meia
// roda de cor por passo (7 de 13, primo entre si — visita as 13 cores
// uma vez cada antes de repetir). Usada quando a cor é atribuída pela
// POSIÇÃO do item num gráfico (não pelo hash do rótulo) — hash por
// rótulo pode colocar itens parecidos (ex. "Nível 1"/"Nível 2", que só
// diferem no último caractere) em tons vizinhos do mesmo matiz por
// coincidência (reportado pelo usuário como "tons e subtons da mesma
// cor até mudar"); posição garante o contraste máximo entre vizinhos
// de qualquer forma.
const SPREAD_ORDER = [0, 7, 1, 8, 2, 9, 3, 10, 4, 11, 5, 12, 6];

export function getSpreadColor(index: number): string {
  return VIBRANT_COLORS[SPREAD_ORDER[index % SPREAD_ORDER.length]];
}

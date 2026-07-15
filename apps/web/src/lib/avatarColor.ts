// Paleta de cores vivas pra fundo de avatares sem foto (programas,
// templates de pontuação, equipes, ...). A cor é determinística (hash
// do id/nome) — o mesmo item sempre cai na mesma cor, só "parece
// aleatória" entre itens diferentes; não muda a cada re-render/reload.
const VIBRANT_COLORS = [
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

export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return VIBRANT_COLORS[Math.abs(hash) % VIBRANT_COLORS.length];
}

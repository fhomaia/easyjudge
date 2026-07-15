// Rótulos/descrições ficam só no frontend (mesmo padrão de UserRole/
// ROLE_LABELS) — o backend manda só a chave. Extensível depois via
// migration ADD VALUE, mesmo padrão já usado em UserRole/EventMemberRole.
export enum SpecialJudgeRole {
  LEGALITY_JUDGE = 'legality_judge',
  HEAD_JUDGE = 'head_judge',
}

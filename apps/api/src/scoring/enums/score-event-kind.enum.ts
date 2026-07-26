// Cada "kind" usa um subconjunto diferente das colunas opcionais de
// ScoreEvent — ver comentário na entidade. Extensível via migration
// ADD VALUE, mesmo padrão de UserRole/EventMemberRole.
export enum ScoreEventKind {
  SCORE_SET = 'score_set',
  DEDUCTION_ADD = 'deduction_add',
  DEDUCTION_REMOVE = 'deduction_remove',
  COMMENT_SET = 'comment_set',
  SKETCH_SET = 'sketch_set',
  // Marcador emitido quando o jurado clica "Lançar notas" (ver
  // EventLiveScoringPage.handleSubmit) — não carrega nenhuma coluna
  // extra, só sinaliza "esta apresentação não exige mais ação deste
  // jurado" pra tela de Notas (ScoringService.getMySubmittedEntryIds).
  SHEET_SUBMITTED = 'sheet_submitted',
  // Jurado de Legalidade clica "Parar" — guarda o tempo TOTAL marcado
  // pelo cronômetro (`presentationElapsedMs`), pra reabrir a
  // apresentação depois mostrar o relógio já parado nesse valor em vez
  // de reiniciar do zero (ver ScoringService.getSheet/reduceScoreEvents
  // no frontend).
  TIMER_STOPPED = 'timer_stopped',
  // Anota/edita o código da infração num evento DEDUCTION_ADD do tipo
  // "legality_infractions" já existente — `undoesEventId` reaponta pro
  // id daquele evento (reuso do campo, não é um "desfazer" de verdade
  // aqui) e `text` carrega o código. Não trava a tela no momento do
  // registro — o jurado preenche depois, quando tiver tempo.
  DEDUCTION_CODE_SET = 'deduction_code_set',
}

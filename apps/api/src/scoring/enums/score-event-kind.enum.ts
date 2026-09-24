// Cada "kind" usa um subconjunto diferente das colunas opcionais de
// ScoreEvent — ver comentário na entidade. Extensível via migration
// ADD VALUE, mesmo padrão de UserRole/EventMemberRole.
export enum ScoreEventKind {
  SCORE_SET = 'score_set',
  DEDUCTION_ADD = 'deduction_add',
  DEDUCTION_REMOVE = 'deduction_remove',
  COMMENT_SET = 'comment_set',
  SKETCH_SET = 'sketch_set',
  // Rascunho digitado (modo "Caixa de texto" do RascunhoEditor) —
  // guardado À PARTE de SKETCH_SET (não reaproveita o mesmo campo/
  // formato) pra desenho e texto nunca se apagarem um ao outro ao
  // trocar de modo (pedido do usuário, 2026-09-19). Mesma privacidade
  // de SKETCH_SET: só o próprio jurado vê (ver getSheetForJudge).
  SKETCH_TEXT_SET = 'sketch_text_set',
  // Marcador emitido quando o jurado clica "Lançar notas" (ver
  // EventLiveScoringPage.handleSubmit) — não carrega nenhuma coluna
  // extra, só sinaliza "esta apresentação não exige mais ação deste
  // jurado" pra tela de Notas (ScoringService.getMySubmittedEntryIds).
  SHEET_SUBMITTED = 'sheet_submitted',
  // Jurado da pista (qualquer um, não só o de Legalidade, desde
  // 2026-09-24) clica "Iniciar" — marca o horário real de início da
  // apresentação (ver ScoringService.getStartedPresentations/
  // assertEventStarted). Cada "Iniciar" emite um evento novo (inclusive
  // depois de zerar com "Reiniciar") — o cálculo de atraso usa sempre o
  // PRIMEIRO (mais antigo) `timer_started` de cada apresentação, de
  // qualquer jurado, nunca o mais recente.
  TIMER_STARTED = 'timer_started',
  // Jurado clica "Parar" — guarda o tempo TOTAL marcado pelo cronômetro
  // (`presentationElapsedMs`), pra reabrir a apresentação depois mostrar
  // o relógio já parado nesse valor em vez de reiniciar do zero (ver
  // ScoringService.getSheet/reduceScoreEvents no frontend). "Reiniciar"
  // também grava este evento, com 0: zera e deixa o relógio parado.
  TIMER_STOPPED = 'timer_stopped',
  // Anota/edita o código/especificação de um evento DEDUCTION_ADD já
  // existente, de um tipo marcado `requiresCode: true` no sistema de
  // pontuação (ver TemplateDeduction) — `undoesEventId` reaponta pro id
  // daquele evento (reuso do campo, não é um "desfazer" de verdade
  // aqui) e `text` carrega o código. Não trava a tela no momento do
  // registro — o jurado preenche depois, quando tiver tempo.
  DEDUCTION_CODE_SET = 'deduction_code_set',
}

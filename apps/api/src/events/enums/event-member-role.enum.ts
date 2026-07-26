// Papel do usuário DENTRO de um evento específico (via EventMember) —
// não confundir com o UserRole global (judge/organization/athlete/program).
// Um jurado (UserRole.JUDGE) só enxerga/atua sobre um evento se tiver
// um EventMember para ele; ADMIN e JUDGE veem o evento em qualquer
// status, ASSESSOR/PROGRAM/SPECTATOR só quando published/started/completed.
// Renomeado de PARTICIPANT pra ASSESSOR em 2026-07-19 (ver migration
// RenameEventMemberParticipantToAssessor) — o papel é de quem ajuda a
// configurar o evento (edita, mas não mexe em acessos/pessoas), não um
// "participante" genérico.
//
// PROGRAM (2026-07-25): concedido automaticamente a todo
// ProgramParticipation vinculado a um usuário (ver
// ProgramsService.create/linkUnclaimedProgramsByEmail) — é o que dá
// acesso à visão da equipe na tela de notas (EventLiveTeamNotesPage).
// Deliberadamente SEPARADO de SPECTATOR: espectador genérico (público
// que só assiste, sem vínculo com nenhuma equipe) não deve ter acesso
// às telas "ao vivo" do evento (ver useEventLiveGuard) — só
// admin/assessor/jurado/equipe/atleta.
//
// ATHLETE (2026-07-26): concedido a todo AthleteLink com os dois lados
// resolvidos (conta do atleta + conta do programa), em TODO evento onde
// aquele programa tem papel PROGRAM — independente do vínculo estar
// confirmado ou não (ver AthletesService.syncEventAccessForLink). Isso já
// libera Início/Cronograma/Resultados; a confirmação do programa só
// gateia o conteúdo da tela de Notas (checado no backend na hora de
// montar a resposta, não aqui no papel) — ver
// ScoringService.getAthleteOverview.
export enum EventMemberRole {
  ADMIN = 'admin',
  JUDGE = 'judge',
  ASSESSOR = 'assessor',
  SPECTATOR = 'spectator',
  PROGRAM = 'program',
  ATHLETE = 'athlete',
}

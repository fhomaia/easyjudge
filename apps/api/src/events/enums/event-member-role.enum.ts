// Papel do usuário DENTRO de um evento específico (via EventMember) —
// não confundir com o UserRole global (judge/organization/athlete/program).
// Um jurado (UserRole.JUDGE) só enxerga/atua sobre um evento se tiver
// um EventMember para ele; ADMIN e JUDGE veem o evento em qualquer
// status, ASSESSOR e SPECTATOR só quando published/started/completed.
// Renomeado de PARTICIPANT pra ASSESSOR em 2026-07-19 (ver migration
// RenameEventMemberParticipantToAssessor) — o papel é de quem ajuda a
// configurar o evento (edita, mas não mexe em acessos/pessoas), não um
// "participante" genérico.
export enum EventMemberRole {
  ADMIN = 'admin',
  JUDGE = 'judge',
  ASSESSOR = 'assessor',
  SPECTATOR = 'spectator',
}

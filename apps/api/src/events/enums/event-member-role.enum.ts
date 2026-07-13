// Papel do usuário DENTRO de um evento específico (via EventMember) —
// não confundir com o UserRole global (judge/organization/athlete/gym).
// Um jurado (UserRole.JUDGE) só enxerga/atua sobre um evento se tiver
// um EventMember para ele; ADMIN e JUDGE veem o evento em qualquer
// status, PARTICIPANT e SPECTATOR só quando published/started/completed.
export enum EventMemberRole {
  ADMIN = 'admin',
  JUDGE = 'judge',
  PARTICIPANT = 'participant',
  SPECTATOR = 'spectator',
}

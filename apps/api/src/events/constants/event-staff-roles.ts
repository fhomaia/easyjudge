import { EventMemberRole } from '../enums/event-member-role.enum';

// Papéis "de gestão" do evento — únicos que: (1) enxergam o evento
// ainda em status `created` (ver EventsService.findAllForUser/canSee e
// EventMemberGuard), (2) aparecem no roster manual de "Gerenciar
// acessos" (ver EventStaffService), (3) recebem notificação de
// audiência STAFF (ver NotificationsService). PROGRAM/ATHLETE/
// SPECTATOR são concedidos automaticamente por outros fluxos (vínculo
// de programa/atleta, código+QR) e nunca são "staff" pra nenhum desses
// 3 fins. Única fonte de verdade — antes desta constante existir, 3
// arquivos redefiniam a mesma lista localmente e uma delas (Events
// Service) tinha ficado desatualizada (sem ASSESSOR), causando uma
// inconsistência real: assessor não via evento em rascunho apesar de
// já poder editar a configuração dele (2026-09-23).
export const EVENT_STAFF_ROLES = [
  EventMemberRole.ADMIN,
  EventMemberRole.ASSESSOR,
  EventMemberRole.JUDGE,
];

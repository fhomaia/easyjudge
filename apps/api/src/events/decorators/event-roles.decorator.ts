import { SetMetadata } from '@nestjs/common';
import { EventMemberRole } from '../enums/event-member-role.enum';

// Espelha @Roles/RolesGuard (auth/), mas checa o papel DENTRO do
// evento (EventMember.roles), não a role global da conta — ver
// EventMemberGuard.
export const EVENT_ROLES_KEY = 'eventRoles';
export const EventRoles = (...roles: EventMemberRole[]) =>
  SetMetadata(EVENT_ROLES_KEY, roles);

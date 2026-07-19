import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EVENT_ROLES_KEY } from '../decorators/event-roles.decorator';
import { EventsService } from '../services/events.service';
import { EventMemberRole } from '../enums/event-member-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Checa se o usuário logado tem, no EventMember do evento (:eventId da
// rota), um dos papéis exigidos por @EventRoles(...) — mesmo padrão de
// RolesGuard/@Roles, mas por papel DE EVENTO, não role global da
// conta. Os dois guards rodam em conjunto: RolesGuard barra contas do
// tipo errado (ex: ATHLETE não pode nem tentar), EventMemberGuard barra
// contas do tipo certo mas sem vínculo (ou vínculo insuficiente) com
// ESTE evento específico.
@Injectable()
export class EventMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly eventsService: EventsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<EventMemberRole[]>(
      EVENT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const eventId = req.params.eventId;
    if (typeof eventId !== 'string') return true; // rota sem :eventId — @EventRoles não se aplica

    const { member } = await this.eventsService.getMemberForEventId(
      eventId,
      req.user.userId,
    );
    if (!member || !requiredRoles.some((r) => member.roles.includes(r))) {
      throw new ForbiddenException(
        'Você não tem permissão para isso neste evento.',
      );
    }
    return true;
  }
}

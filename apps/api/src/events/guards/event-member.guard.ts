import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EVENT_ROLES_KEY } from '../decorators/event-roles.decorator';
import { EventsService, VISIBLE_TO_NON_STAFF } from '../services/events.service';
import { EventMemberRole } from '../enums/event-member-role.enum';
import { EVENT_STAFF_ROLES } from '../constants/event-staff-roles';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Checa se o usuário logado tem, no EventMember do evento (:eventId da
// rota — desde 2026-07-27 é o `aliasId`, não mais o `id` de uma versão
// específica, ver EventsService.findEventOrThrow), um dos papéis
// exigidos por @EventRoles(...) — mesmo padrão de RolesGuard/@Roles,
// mas por papel DE EVENTO, não role global da conta. Os dois guards
// rodam em conjunto: RolesGuard barra contas do tipo errado (ex: ATHLETE
// não pode nem tentar), EventMemberGuard barra contas do tipo certo mas
// sem vínculo (ou vínculo insuficiente) com ESTE evento específico.
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

    const { event, member } = await this.eventsService.getMemberForEventId(
      eventId,
      req.user.userId,
    );
    if (!member || !requiredRoles.some((r) => member.roles.includes(r))) {
      throw new ForbiddenException(
        'Você não tem permissão para isso neste evento.',
      );
    }

    // Fecha o mesmo gap que EventsService.canSee/findOneForUser já
    // cobre pra GET /events/:id — antes desta checagem, um
    // program/athlete (que já ganham EventMember antes da publicação,
    // durante o cadastro do roster) conseguia chamar rotas filhas
    // deste guard (cronograma, member-counts etc.) direto e pegar dado
    // real de um evento ainda "created", mesmo sem a Home linkar pra
    // lá (2026-09-23, ver findAllForUser). Quem é EVENT_STAFF_ROLES
    // continua sem essa restrição — precisa acessar essas mesmas rotas
    // durante o Setup, antes de publicar.
    const isStaff = member.roles.some((r) => EVENT_STAFF_ROLES.includes(r));
    if (!isStaff && !VISIBLE_TO_NON_STAFF.includes(event.status)) {
      throw new ForbiddenException('Este evento ainda não foi publicado.');
    }
    return true;
  }
}

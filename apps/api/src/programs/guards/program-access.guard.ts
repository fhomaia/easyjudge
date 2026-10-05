import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { EventsService } from '../../events/services/events.service';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import { isRegistrationOpen } from '../../events/registration-window';
import {
  programCanEditRegistration,
  REGISTRATION_LOCKED_MESSAGE,
} from '../registration-edit';
import { UserRole } from '../../common/enums/user-role.enum';
import { ProgramsService } from '../services/programs.service';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

const STAFF_ACCOUNT_ROLES: string[] = [UserRole.JUDGE, UserRole.ORGANIZATION];
const STAFF_EVENT_ROLES = [EventMemberRole.ADMIN, EventMemberRole.ASSESSOR];

// Rotas de um programa do evento (`/events/:eventId/programs/:programId/
// teams|athletes`). Libera dois públicos (2026-10-05, inscrição pelo
// próprio programa):
// - staff: conta Jurado/Organização com papel admin/assessor no evento
//   (o mesmo que RolesGuard + EventMemberGuard exigiam antes);
// - o dono: a conta Programa vinculada a ESTE programa. Lê sempre; só
//   escreve quando programCanEditRegistration deixa (rascunho dentro do
//   prazo, ou ficha devolvida pelo organizador).
// Não passa pelo EventMemberGuard de propósito: o programa precisa
// montar a inscrição com o evento ainda em rascunho.
@Injectable()
export class ProgramAccessGuard implements CanActivate {
  constructor(
    private readonly eventsService: EventsService,
    private readonly programsService: ProgramsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { eventId, programId } = req.params;
    if (typeof eventId !== 'string' || typeof programId !== 'string') {
      throw new ForbiddenException('Você não tem permissão para isso neste evento.');
    }
    const { userId, role } = req.user;

    if (STAFF_ACCOUNT_ROLES.includes(role)) {
      const { member } = await this.eventsService.getMemberForEventId(
        eventId,
        userId,
      );
      if (member && STAFF_EVENT_ROLES.some((r) => member.roles.includes(r))) {
        return true;
      }
    }

    if (role === UserRole.PROGRAM) {
      const event = await this.eventsService.findEventOrThrow(eventId);
      const program = await this.programsService.findProgramOrThrow(
        eventId,
        programId,
      );
      if (program.userId === userId) {
        if (req.method === 'GET' || programCanEditRegistration(event, program)) {
          return true;
        }
        throw new ForbiddenException(
          program.submittedAt && isRegistrationOpen(event)
            ? REGISTRATION_LOCKED_MESSAGE
            : 'As inscrições deste evento estão encerradas.',
        );
      }
    }

    throw new ForbiddenException('Você não tem permissão para isso neste evento.');
  }
}

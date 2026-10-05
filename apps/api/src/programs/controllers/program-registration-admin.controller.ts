import {
  Controller,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProgramRegistrationService } from '../services/program-registration.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Lado do organizador da ficha de inscrição de um programa: pedidos do
// programa e "Liberar edição". Mesmos guards do ProgramsController.
@Controller('events/:eventId')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
@EventRoles(EventMemberRole.ADMIN, EventMemberRole.ASSESSOR)
export class ProgramRegistrationAdminController {
  constructor(private readonly registrationService: ProgramRegistrationService) {}

  // Todos os pedidos do evento (aba Solicitações da tela de Programas).
  @Get('registration-requests')
  listEventRequests(@Param('eventId') eventId: string) {
    return this.registrationService.listEventRequests(eventId);
  }

  @Get('programs/:programId/registration/requests')
  listRequests(@Param('eventId') eventId: string, @Param('programId') programId: string) {
    return this.registrationService.listRequests(eventId, programId);
  }

  @Patch('programs/:programId/registration/requests/:requestId/resolve')
  resolve(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('requestId') requestId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.registrationService.resolveRequest(
      eventId,
      programId,
      requestId,
      req.user.userId,
    );
  }

  @Post('programs/:programId/registration/requests/:requestId/accept-cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  acceptCancel(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('requestId') requestId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.registrationService.acceptCancel(
      eventId,
      programId,
      requestId,
      req.user.userId,
    );
  }

  @Post('programs/:programId/registration/reopen')
  reopen(@Param('eventId') eventId: string, @Param('programId') programId: string) {
    return this.registrationService.reopen(eventId, programId);
  }
}

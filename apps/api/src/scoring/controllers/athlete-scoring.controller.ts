import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ScoringService } from '../services/scoring.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Visão do Atleta na tela de Notas — igual à do Programa
// (TeamScoringController), mas filtrada pela união dos times de todos
// os programas com vínculo CONFIRMADO (ver AthletesService/
// ScoringService.getAthleteOverview). Acesso via papel ATHLETE
// (concedido a todo AthleteLink com os dois lados resolvidos,
// independente de confirmado — ver EventMemberRole.ATHLETE); a
// confirmação em si só é checada dentro do service, não no guard —
// sem confirmação a rota responde `{ locked: true }`, não 403 (a tela
// de Notas fica visível-mas-bloqueada, não escondida).
@Controller('events/:eventId/scoring/athlete')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
@Roles(UserRole.ATHLETE)
@EventRoles(EventMemberRole.ATHLETE)
export class AthleteScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Get('overview')
  getOverview(
    @Param('eventId') eventId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringService.getAthleteOverview(eventId, req.user.userId);
  }

  @Get(':scheduleEntryId')
  getDetail(
    @Param('eventId') eventId: string,
    @Param('scheduleEntryId') scheduleEntryId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringService.getAthletePresentationDetail(
      eventId,
      scheduleEntryId,
      req.user.userId,
    );
  }
}

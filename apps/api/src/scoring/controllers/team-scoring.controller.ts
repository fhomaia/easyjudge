import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ScoringService } from '../services/scoring.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Visão do Programa (dono da equipe) na tela de notas — só as próprias
// equipes, só depois de liberado. Acesso via papel "programa"
// (concedido automaticamente a todo ProgramParticipation vinculado a
// um usuário — ver ProgramsService.create/linkUnclaimedProgramsByEmail),
// não via JudgeParticipation. Deliberadamente não é SPECTATOR —
// espectador genérico não deve ter acesso a esta tela.
@Controller('events/:eventId/scoring/team')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
@Roles(UserRole.PROGRAM)
@EventRoles(EventMemberRole.PROGRAM)
export class TeamScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Get('overview')
  getOverview(
    @Param('eventId') eventId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringService.getTeamOverview(eventId, req.user.userId);
  }

  @Get(':scheduleEntryId')
  getDetail(
    @Param('eventId') eventId: string,
    @Param('scheduleEntryId') scheduleEntryId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringService.getTeamPresentationDetail(
      eventId,
      scheduleEntryId,
      req.user.userId,
    );
  }

  @Post(':scheduleEntryId/contest')
  contest(
    @Param('eventId') eventId: string,
    @Param('scheduleEntryId') scheduleEntryId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringService.requestContestation(
      eventId,
      scheduleEntryId,
      req.user.userId,
    );
  }
}

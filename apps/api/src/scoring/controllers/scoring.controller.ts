import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ScoringService } from '../services/scoring.service';
import { SubmitScoreEventsDto } from '../dto/submit-score-events.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Só jurado mesmo (não admin/assessor) — quem pontua é quem está
// escalado, ver plano/CLAUDE.md.
@Controller('events/:eventId/scoring')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
@EventRoles(EventMemberRole.JUDGE)
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Get('sheet/:scheduleEntryId')
  getSheet(
    @Param('eventId') eventId: string,
    @Param('scheduleEntryId') scheduleEntryId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringService.getSheet(
      eventId,
      req.user.userId,
      scheduleEntryId,
    );
  }

  @Get('me/submissions')
  getMySubmittedEntryIds(
    @Param('eventId') eventId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringService.getMySubmittedEntryIds(eventId, req.user.userId);
  }

  // Alimenta o card "Atraso atual" do painel Início — todo mundo que
  // enxerga essa tela precisa ler isso (não é uma ação de jurado), não
  // só admin/assessor/jurado — programa e atleta também veem Início
  // (ver useEventLiveGuard no front). Sobrescreve o @EventRoles(JUDGE)
  // da classe só nesta rota.
  @Get('started-presentations')
  @EventRoles(
    EventMemberRole.ADMIN,
    EventMemberRole.ASSESSOR,
    EventMemberRole.JUDGE,
    EventMemberRole.PROGRAM,
    EventMemberRole.ATHLETE,
  )
  getStartedPresentations(@Param('eventId') eventId: string) {
    return this.scoringService.getStartedPresentations(eventId);
  }

  // Mesmo raciocínio de started-presentations — alimenta o cronograma
  // ao vivo (ver ScoringService.getCompletedPresentationIds).
  @Get('completed-presentations')
  @EventRoles(
    EventMemberRole.ADMIN,
    EventMemberRole.ASSESSOR,
    EventMemberRole.JUDGE,
    EventMemberRole.PROGRAM,
    EventMemberRole.ATHLETE,
  )
  getCompletedPresentationIds(@Param('eventId') eventId: string) {
    return this.scoringService.getCompletedPresentationIds(eventId);
  }

  @Post('sheet/:scheduleEntryId/resolve-contestation')
  resolveContestation(
    @Param('eventId') eventId: string,
    @Param('scheduleEntryId') scheduleEntryId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringService.resolveContestation(
      eventId,
      req.user.userId,
      scheduleEntryId,
    );
  }

  @Post('events')
  submitEvents(
    @Param('eventId') eventId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: SubmitScoreEventsDto,
  ) {
    return this.scoringService.submitEvents(
      eventId,
      req.user.userId,
      dto.events,
    );
  }

  // Painel Head Judge (Modo Supervisão) — a checagem fina de "é Head
  // Judge DESTE recurso mesmo" fica no service (mesmo padrão do Jurado
  // de Legalidade), os guards da classe só garantem que quem chama é
  // jurado do evento.

  @Get('head-judge/:scheduleEntryId/roster')
  getHeadJudgeRoster(
    @Param('eventId') eventId: string,
    @Param('scheduleEntryId') scheduleEntryId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringService.getHeadJudgeRoster(
      eventId,
      req.user.userId,
      scheduleEntryId,
    );
  }

  @Get('head-judge/:scheduleEntryId/judges/:judgeParticipationId/sheet')
  getHeadJudgeSheet(
    @Param('eventId') eventId: string,
    @Param('scheduleEntryId') scheduleEntryId: string,
    @Param('judgeParticipationId') judgeParticipationId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringService.getSheetForJudge(
      eventId,
      req.user.userId,
      scheduleEntryId,
      judgeParticipationId,
    );
  }

  @Post('head-judge/:scheduleEntryId/judges/:judgeParticipationId/events')
  submitHeadJudgeEvents(
    @Param('eventId') eventId: string,
    @Param('scheduleEntryId') scheduleEntryId: string,
    @Param('judgeParticipationId') judgeParticipationId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: SubmitScoreEventsDto,
  ) {
    return this.scoringService.submitEventsAsHeadJudge(
      eventId,
      req.user.userId,
      scheduleEntryId,
      judgeParticipationId,
      dto.events,
    );
  }

  @Get('head-judge/:scheduleEntryId/log')
  getHeadJudgeLog(
    @Param('eventId') eventId: string,
    @Param('scheduleEntryId') scheduleEntryId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringService.getChangeLog(
      eventId,
      req.user.userId,
      scheduleEntryId,
    );
  }
}

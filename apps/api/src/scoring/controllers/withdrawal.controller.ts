import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ScoringService } from '../services/scoring.service';
import { WithdrawPresentationDto } from '../dto/withdraw-presentation.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Fluxo de desistência (2026-07-26) — a única ação que precisa de
// admin/assessor E programa na mesma rota (nenhum controller de scoring
// existente serve mais de uma audiência), por isso ganhou controller
// próprio em vez de entrar em ScoringController (jurado-only) ou
// AdminScoringController/TeamScoringController (audiência única cada).
// A checagem fina (programa só pode nas próprias equipes) roda dentro
// de ScoringService.withdrawPresentation, não aqui — o guard só garante
// que o papel É um dos três.
@Controller('events/:eventId/scoring/entries')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION, UserRole.PROGRAM)
@EventRoles(
  EventMemberRole.ADMIN,
  EventMemberRole.ASSESSOR,
  EventMemberRole.PROGRAM,
)
export class WithdrawalController {
  constructor(private readonly scoringService: ScoringService) {}

  @Post(':scheduleEntryId/withdraw')
  @HttpCode(HttpStatus.NO_CONTENT)
  withdraw(
    @Param('eventId') eventId: string,
    @Param('scheduleEntryId') scheduleEntryId: string,
    @Body() dto: WithdrawPresentationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringService.withdrawPresentation(
      eventId,
      req.user.userId,
      scheduleEntryId,
      dto,
    );
  }
}

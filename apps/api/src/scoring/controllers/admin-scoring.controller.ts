import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ScoringService } from '../services/scoring.service';
import { SetPresentationReleaseDto } from '../dto/set-presentation-release.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';

// Visão do admin/assessor na tela de Notas — leitura de tudo que foi
// lançado (sem poder de edição) + toggles de liberação. Mesmo padrão
// de guard de EventTeamsController (não exige JudgeParticipation, só o
// papel admin/assessor no evento).
@Controller('events/:eventId/scoring/admin')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
@EventRoles(EventMemberRole.ADMIN, EventMemberRole.ASSESSOR)
export class AdminScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Get('overview')
  getOverview(@Param('eventId') eventId: string) {
    return this.scoringService.getAdminOverview(eventId);
  }

  // Liberação global do evento (notas/contestação/resultado) — ação
  // única pro evento inteiro, não por apresentação (rota fixa
  // "release", precisa vir antes de ":scheduleEntryId" pra não ser
  // interpretada como um id).
  @Get('release')
  getRelease(@Param('eventId') eventId: string) {
    return this.scoringService.getReleaseFlags(eventId);
  }

  @Patch('release')
  setRelease(
    @Param('eventId') eventId: string,
    @Body() dto: SetPresentationReleaseDto,
  ) {
    return this.scoringService.setReleaseFlags(eventId, dto);
  }

  @Get(':scheduleEntryId')
  getDetail(
    @Param('eventId') eventId: string,
    @Param('scheduleEntryId') scheduleEntryId: string,
  ) {
    return this.scoringService.getAdminPresentationDetail(
      eventId,
      scheduleEntryId,
    );
  }
}

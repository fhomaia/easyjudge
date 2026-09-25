import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ScoringService } from '../services/scoring.service';
import { SetPresentationReleaseDto } from '../dto/set-presentation-release.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';

// Visão do admin/assessor na tela de Notas — leitura de tudo que foi
// lançado (sem poder de edição) + toggles de liberação. Mesmo padrão
// de guard de EventTeamsController (não exige JudgeParticipation, só o
// papel admin/assessor no evento).
@Controller('events/:eventId/scoring/admin')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
// Sem @Roles (tipo de conta) de propósito: nas telas do evento ao vivo
// o acesso é decidido só pelo papel no evento (@EventRoles abaixo).
// Ex.: uma conta de espectador/atleta escalada como jurado.
@EventRoles(EventMemberRole.ADMIN, EventMemberRole.ASSESSOR)
export class AdminScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Get('overview')
  getOverview(@Param('eventId') eventId: string) {
    return this.scoringService.getAdminOverview(eventId);
  }

  // Liberação de notas/contestação/resultado por categoria em cada dia
  // (rota fixa "release", precisa vir antes de ":scheduleEntryId" pra
  // não ser interpretada como um id).
  @Get('release')
  getRelease(@Param('eventId') eventId: string) {
    return this.scoringService.getReleaseState(eventId);
  }

  @Patch('release')
  setRelease(
    @Param('eventId') eventId: string,
    @Body() dto: SetPresentationReleaseDto,
  ) {
    const { dayId, categoryId, ...changes } = dto;
    return this.scoringService.setRelease(
      eventId,
      { dayId, categoryId },
      changes,
    );
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

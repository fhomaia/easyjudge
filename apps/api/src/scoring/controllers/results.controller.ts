import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ScoringService } from '../services/scoring.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Página de Resultados — diferente de AdminScoringController (visão de
// trabalho do produtor, sem gate), esta rota é a que qualquer membro
// do evento acessa: admin/assessor/jurado sempre veem, programa/
// espectador (e, futuramente, atleta) só depois que o admin ligar
// `Event.resultsReleasedAt` (ver ScoringService.getPublicEventResults).
// Sem @Roles global de conta de propósito — um espectador pode ser
// qualquer tipo de UserRole, o que importa é o EventMemberRole dele
// NESTE evento.
@Controller('events/:eventId/scoring/results')
@UseGuards(JwtAuthGuard, EventMemberGuard)
@EventRoles(
  EventMemberRole.ADMIN,
  EventMemberRole.ASSESSOR,
  EventMemberRole.JUDGE,
  EventMemberRole.PROGRAM,
  EventMemberRole.SPECTATOR,
)
export class ResultsController {
  constructor(private readonly scoringService: ScoringService) {}

  @Get()
  get(@Param('eventId') eventId: string, @Req() req: AuthenticatedRequest) {
    return this.scoringService.getPublicEventResults(eventId, req.user.userId);
  }
}

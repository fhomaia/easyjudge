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
// atleta/espectador só depois que o admin ligar
// `Event.resultsReleasedAt` (ver ScoringService.getPublicEventResults).
// Sem @Roles global de conta de propósito — um espectador pode ser
// qualquer tipo de UserRole, o que importa é o EventMemberRole dele
// NESTE evento.
//
// ATHLETE ficou de fora até 2026-08-01 (o comentário antigo já dizia
// "futuramente, atleta" — nunca foi adicionado de fato quando a
// jornada do atleta foi construída; mesmo bug já visto em
// ScheduleController.getDays pra PROGRAM/ATHLETE, causava 403 na tela
// de Resultados pro atleta).
@Controller('events/:eventId/scoring/results')
@UseGuards(JwtAuthGuard, EventMemberGuard)
@EventRoles(
  EventMemberRole.ADMIN,
  EventMemberRole.ASSESSOR,
  EventMemberRole.JUDGE,
  EventMemberRole.PROGRAM,
  EventMemberRole.ATHLETE,
  EventMemberRole.SPECTATOR,
)
export class ResultsController {
  constructor(private readonly scoringService: ScoringService) {}

  @Get()
  get(@Param('eventId') eventId: string, @Req() req: AuthenticatedRequest) {
    return this.scoringService.getPublicEventResults(eventId, req.user.userId);
  }
}

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventMetricsService } from '../services/event-metrics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';

// Alcançada só pelo menu "⋯" da listagem de eventos (ver
// EventActionsMenu no frontend) — mesmo alcance de Histórico/Gerenciar
// acessos: só admin/assessor.
@Controller('events/:eventId/metrics')
@UseGuards(JwtAuthGuard, EventMemberGuard)
@EventRoles(EventMemberRole.ADMIN, EventMemberRole.ASSESSOR)
export class EventMetricsController {
  constructor(private readonly eventMetricsService: EventMetricsService) {}

  @Get()
  get(@Param('eventId') eventId: string) {
    return this.eventMetricsService.getEventMetrics(eventId);
  }
}

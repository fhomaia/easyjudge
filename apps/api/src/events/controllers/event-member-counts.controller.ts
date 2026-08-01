import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventsService } from '../services/events.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EventMemberGuard } from '../guards/event-member.guard';
import { EventRoles } from '../decorators/event-roles.decorator';
import { EventMemberRole } from '../enums/event-member-role.enum';

// Contagem de pessoas por papel no roster do evento — alimenta os
// cards "Jurados cadastrados"/"Programas cadastrados"/"Espectadores"/
// "Atletas" do painel Início. Acesso amplo (mesmo conjunto de papéis
// que já enxerga essa tela — ver useEventLiveGuard no front): é só uma
// contagem, não expõe nome/email de ninguém. SPECTATOR entrou em
// 2026-08-01, junto da Início ficar disponível pra qualquer papel
// (pedido do usuário) — sem isso, os cards "Espectadores"/"Atletas"
// ficavam sempre "0" pra quem via a tela como espectador (fetch dando
// 403, caindo no fallback silencioso do frontend).
@Controller('events/:eventId/member-counts')
@UseGuards(JwtAuthGuard, EventMemberGuard)
@EventRoles(
  EventMemberRole.ADMIN,
  EventMemberRole.ASSESSOR,
  EventMemberRole.JUDGE,
  EventMemberRole.PROGRAM,
  EventMemberRole.ATHLETE,
  EventMemberRole.SPECTATOR,
)
export class EventMemberCountsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  get(@Param('eventId') eventId: string) {
    return this.eventsService.getMemberRoleCounts(eventId);
  }
}

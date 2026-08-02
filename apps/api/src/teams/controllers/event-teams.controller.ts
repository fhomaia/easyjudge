import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { TeamsService } from '../services/teams.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';

// Equipes de TODO o evento (não aninhado por programId) — usado pela
// aba "Visão geral das categorias" da tela de Programas e equipes, que
// precisa saber quantas equipes (de quaisquer programas) estão
// inscritas em cada categoria. Rota separada do TeamsController porque
// ali `:programId` é parte fixa do path.
@Controller('events/:eventId/teams')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
export class EventTeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // Liberado pra SPECTATOR em 2026-08-02: a tela de Cronograma ao vivo
  // (EventLiveSchedulePage) passou a ficar disponível pra espectador
  // (mesmo motivo do Cronograma em si, ver schedule.controller.ts) e
  // usa esta lista pra montar os filtros "Programas"/"Equipes" e a
  // coluna "Programa" do PDF exportado — sem SPECTATOR aqui, esses dois
  // ficavam quebrados em silêncio (o `.catch` engolia o 403).
  @Get()
  @Roles(UserRole.JUDGE, UserRole.ORGANIZATION, UserRole.PROGRAM, UserRole.ATHLETE)
  @EventRoles(
    EventMemberRole.ADMIN,
    EventMemberRole.ASSESSOR,
    EventMemberRole.SPECTATOR,
  )
  findAll(@Param('eventId') eventId: string) {
    return this.teamsService.findAllForEvent(eventId);
  }
}

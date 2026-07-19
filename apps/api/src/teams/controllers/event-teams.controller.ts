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
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
@EventRoles(EventMemberRole.ADMIN, EventMemberRole.ASSESSOR)
export class EventTeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  findAll(@Param('eventId') eventId: string) {
    return this.teamsService.findAllForEvent(eventId);
  }
}

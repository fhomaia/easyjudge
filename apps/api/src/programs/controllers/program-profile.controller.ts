import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ProgramsService } from '../services/programs.service';
import { UpdateOwnProgramDto } from '../dto/update-own-program.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Endpoints do próprio usuário PROGRAM sobre as ProgramParticipation
// vinculadas a ele (ver ProgramsService.linkUnclaimedProgramsByEmail)
// — não aninhado
// em /events/:eventId porque a edição vale globalmente, pra todos os
// eventos onde esse programa está cadastrado de uma vez (decisão do
// usuário). Ainda sem tela própria no frontend — só a base no backend
// por enquanto, mesmo padrão já usado pra outras jornadas futuras.
@Controller('programs/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PROGRAM)
export class ProgramProfileController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  findMine(@Req() req: AuthenticatedRequest) {
    return this.programsService.findAllForUser(req.user.userId);
  }

  @Patch()
  updateMine(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateOwnProgramDto,
  ) {
    return this.programsService.updateOwnProfile(req.user.userId, dto);
  }
}

import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AthletesService } from '../services/athletes.service';
import { RequestProgramLinkDto } from '../dto/request-program-link.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// "Meus programas" do PRÓPRIO atleta logado — o primeiro vínculo é
// criado no cadastro (ver AuthService.setPassword), esta rota é pra
// adicionar mais programas depois (um atleta pode ter vários).
@Controller('athletes/me/programs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ATHLETE)
export class AthleteProgramsController {
  constructor(private readonly athletesService: AthletesService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.athletesService.listMyPrograms(req.user.userId);
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: RequestProgramLinkDto) {
    return this.athletesService.createOrRequestLink(
      req.user.userId,
      dto.programEmail,
    );
  }
}

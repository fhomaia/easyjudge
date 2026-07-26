import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AthletesService } from '../services/athletes.service';
import { CreateAthleteLinkDto } from '../dto/create-athlete-link.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Elenco de atletas do PRÓPRIO programa logado — global, fora de
// qualquer evento (diferente de JudgeParticipation/ProgramParticipation,
// que são por evento). Ver AthletesService/AthleteLink.
@Controller('athletes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PROGRAM)
export class AthleteRosterController {
  constructor(private readonly athletesService: AthletesService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.athletesService.listForProgram(req.user.userId);
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateAthleteLinkDto) {
    return this.athletesService.create(req.user.userId, dto);
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.athletesService.remove(req.user.userId, id);
  }

  @Post(':id/confirm')
  confirm(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.athletesService.confirm(req.user.userId, id);
  }
}

import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ProgramsService } from '../services/programs.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Lista de escolha pro produtor na hora de cadastrar um programa num
// evento novo: todo usuário role PROGRAM da plataforma + as entradas
// do catálogo deste produtor que ainda não têm conta própria (ver
// ProgramsService.findCatalogForUser) — evita redigitar um programa
// já usado antes por ele ou vincular a uma conta já existente.
@Controller('programs/catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
export class ProgramCatalogController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  findCatalog(@Req() req: AuthenticatedRequest) {
    return this.programsService.findCatalogForUser(req.user.userId);
  }
}

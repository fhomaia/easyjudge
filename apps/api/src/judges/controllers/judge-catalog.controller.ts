import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JudgesService } from '../services/judges.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Lista de escolha pro produtor na hora de cadastrar um jurado num
// evento novo: todo usuário role JUDGE da plataforma + as entradas do
// catálogo deste produtor que ainda não têm conta própria (ver
// JudgesService.findCatalogForUser) — mesmo padrão de
// program-catalog.controller.ts.
@Controller('judges/catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
export class JudgeCatalogController {
  constructor(private readonly judgesService: JudgesService) {}

  @Get()
  findCatalog(@Req() req: AuthenticatedRequest) {
    return this.judgesService.findCatalogForUser(req.user.userId);
  }
}

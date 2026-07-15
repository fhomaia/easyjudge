import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JudgesService } from '../services/judges.service';
import { UpdateOwnJudgeDto } from '../dto/update-own-judge.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Endpoints do próprio usuário JUDGE sobre as JudgeParticipation
// vinculadas a ele (ver JudgesService.linkUnclaimedJudgesByEmail) —
// mesmo padrão de program-profile.controller.ts. Ainda sem tela
// própria no frontend — só a base no backend por enquanto.
@Controller('judges/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JUDGE)
export class JudgeProfileController {
  constructor(private readonly judgesService: JudgesService) {}

  @Get()
  findMine(@Req() req: AuthenticatedRequest) {
    return this.judgesService.findAllForUser(req.user.userId);
  }

  @Patch()
  updateMine(@Req() req: AuthenticatedRequest, @Body() dto: UpdateOwnJudgeDto) {
    return this.judgesService.updateOwnProfile(req.user.userId, dto);
  }
}

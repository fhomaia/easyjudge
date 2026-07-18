import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JudgingService } from '../services/judging.service';
import { SetJudgeIdsDto } from '../dto/set-judge-ids.dto';
import { BulkAssignDto } from '../dto/bulk-assign.dto';
import { SpecialJudgeRole } from '../enums/special-judge-role.enum';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

@Controller('events/:eventId/judging')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
export class JudgingController {
  constructor(private readonly judgingService: JudgingService) {}

  @Get()
  getAssignments(
    @Param('eventId') eventId: string,
    @Query('templateId') templateId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.judgingService.getAssignments(
      eventId,
      templateId,
      req.user.userId,
    );
  }

  @Put('templates/:templateId/criteria/:criterionId/resources/:resourceId/judges')
  setCriterionJudges(
    @Param('eventId') eventId: string,
    @Param('templateId') templateId: string,
    @Param('criterionId') criterionId: string,
    @Param('resourceId') resourceId: string,
    @Body() dto: SetJudgeIdsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.judgingService.setCriterionJudges(
      eventId,
      templateId,
      criterionId,
      resourceId,
      dto.judgeIds,
      req.user.userId,
    );
  }

  @Post('templates/:templateId/criteria/:criterionId/resources/:resourceId/bulk-assign')
  bulkAssign(
    @Param('eventId') eventId: string,
    @Param('templateId') templateId: string,
    @Param('criterionId') criterionId: string,
    @Param('resourceId') resourceId: string,
    @Body() dto: BulkAssignDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.judgingService.bulkAssign(
      eventId,
      templateId,
      criterionId,
      resourceId,
      dto.judgeParticipationId,
      dto.strategy,
      req.user.userId,
    );
  }

  @Get('resources/:resourceId/special-roles')
  getSpecialRoles(
    @Param('eventId') eventId: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.judgingService.getSpecialRoles(eventId, resourceId);
  }

  @Put('resources/:resourceId/special-roles/:role')
  setSpecialRoleJudges(
    @Param('eventId') eventId: string,
    @Param('resourceId') resourceId: string,
    @Param('role') role: SpecialJudgeRole,
    @Body() dto: SetJudgeIdsDto,
  ) {
    return this.judgingService.setSpecialRoleJudges(
      eventId,
      role,
      resourceId,
      dto.judgeIds,
    );
  }
}

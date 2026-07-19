import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Post,
  Query,
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
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';

const WRITE_ROLES = [EventMemberRole.ADMIN, EventMemberRole.ASSESSOR];
const READ_ROLES = [...WRITE_ROLES, EventMemberRole.JUDGE];

@Controller('events/:eventId/judging')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
export class JudgingController {
  constructor(private readonly judgingService: JudgingService) {}

  @Get()
  @EventRoles(...READ_ROLES)
  getAssignments(
    @Param('eventId') eventId: string,
    @Query('templateId') templateId: string,
  ) {
    return this.judgingService.getAssignments(eventId, templateId);
  }

  @Put(
    'templates/:templateId/criteria/:criterionId/resources/:resourceId/judges',
  )
  @EventRoles(...WRITE_ROLES)
  setCriterionJudges(
    @Param('eventId') eventId: string,
    @Param('templateId') templateId: string,
    @Param('criterionId') criterionId: string,
    @Param('resourceId') resourceId: string,
    @Body() dto: SetJudgeIdsDto,
  ) {
    return this.judgingService.setCriterionJudges(
      eventId,
      templateId,
      criterionId,
      resourceId,
      dto.judgeIds,
    );
  }

  @Post(
    'templates/:templateId/criteria/:criterionId/resources/:resourceId/bulk-assign',
  )
  @EventRoles(...WRITE_ROLES)
  bulkAssign(
    @Param('eventId') eventId: string,
    @Param('templateId') templateId: string,
    @Param('criterionId') criterionId: string,
    @Param('resourceId') resourceId: string,
    @Body() dto: BulkAssignDto,
  ) {
    return this.judgingService.bulkAssign(
      eventId,
      templateId,
      criterionId,
      resourceId,
      dto.judgeParticipationId,
      dto.strategy,
    );
  }

  @Get('resources/:resourceId/special-roles')
  @EventRoles(...READ_ROLES)
  getSpecialRoles(
    @Param('eventId') eventId: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.judgingService.getSpecialRoles(eventId, resourceId);
  }

  @Put('resources/:resourceId/special-roles/:role')
  @EventRoles(...WRITE_ROLES)
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

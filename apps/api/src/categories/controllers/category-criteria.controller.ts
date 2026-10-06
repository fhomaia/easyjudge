import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CategoryCriteriaService } from '../services/category-criteria.service';
import { UpdateCategoryCriteriaDto } from '../dto/update-category-criteria.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';

const WRITE_ROLES = [EventMemberRole.ADMIN, EventMemberRole.ASSESSOR];
const READ_ROLES = [...WRITE_ROLES, EventMemberRole.JUDGE];

// Critérios de divisão das categorias do evento (ver category-criteria.ts).
@Controller('events/:eventId/category-criteria')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
export class CategoryCriteriaController {
  constructor(private readonly criteriaService: CategoryCriteriaService) {}

  @Get()
  @EventRoles(...READ_ROLES)
  get(@Param('eventId') eventId: string) {
    return this.criteriaService.getForEvent(eventId);
  }

  @Put()
  @Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
  @EventRoles(...WRITE_ROLES)
  update(
    @Param('eventId') eventId: string,
    @Body() dto: UpdateCategoryCriteriaDto,
  ) {
    return this.criteriaService.update(eventId, dto);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from '../services/categories.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

const WRITE_ROLES = [EventMemberRole.ADMIN, EventMemberRole.ASSESSOR];
const READ_ROLES = [...WRITE_ROLES, EventMemberRole.JUDGE];

@Controller('events/:eventId/categories')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
  @EventRoles(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateCategoryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.categoriesService.create(eventId, dto, req.user.userId);
  }

  @Get()
  @Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
  @EventRoles(...READ_ROLES)
  findAll(@Param('eventId') eventId: string) {
    return this.categoriesService.findAllForEvent(eventId);
  }

  @Patch(':id')
  @Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
  @EventRoles(...WRITE_ROLES)
  update(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.categoriesService.update(eventId, id, dto, req.user.userId);
  }

  @Delete(':id')
  @Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
  @EventRoles(...WRITE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('eventId') eventId: string, @Param('id') id: string) {
    return this.categoriesService.remove(eventId, id);
  }
}

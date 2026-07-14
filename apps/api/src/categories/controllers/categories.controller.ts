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
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

@Controller('events/:eventId/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
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
  findAll(@Param('eventId') eventId: string) {
    return this.categoriesService.findAllForEvent(eventId);
  }

  @Patch(':id')
  @Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
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
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('eventId') eventId: string, @Param('id') id: string) {
    return this.categoriesService.remove(eventId, id);
  }
}

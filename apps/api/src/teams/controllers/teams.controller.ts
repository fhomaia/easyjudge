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
  UseGuards,
} from '@nestjs/common';
import { TeamsService } from '../services/teams.service';
import { CreateTeamDto } from '../dto/create-team.dto';
import { UpdateTeamDto } from '../dto/update-team.dto';
import { AddTeamCategoryDto } from '../dto/add-team-category.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';

@Controller('events/:eventId/programs/:programId/teams')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
@EventRoles(EventMemberRole.ADMIN, EventMemberRole.ASSESSOR)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamsService.create(eventId, programId, dto);
  }

  @Get()
  findAll(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
  ) {
    return this.teamsService.findAllForProgram(eventId, programId);
  }

  @Patch(':teamId')
  update(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('teamId') teamId: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.update(eventId, programId, teamId, dto);
  }

  @Delete(':teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.teamsService.remove(eventId, programId, teamId);
  }

  @Post(':teamId/categories')
  addCategory(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('teamId') teamId: string,
    @Body() dto: AddTeamCategoryDto,
  ) {
    return this.teamsService.addCategory(
      eventId,
      programId,
      teamId,
      dto.categoryId,
    );
  }

  @Delete(':teamId/categories/:categoryId')
  removeCategory(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('teamId') teamId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.teamsService.removeCategory(
      eventId,
      programId,
      teamId,
      categoryId,
    );
  }
}

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
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TeamsService } from '../services/teams.service';
import { CreateTeamDto } from '../dto/create-team.dto';
import { UpdateTeamDto } from '../dto/update-team.dto';
import { AddTeamCategoryDto } from '../dto/add-team-category.dto';
import { SetTeamCategoryAthletesDto } from '../../programs/dto/set-athlete-entries.dto';
import { ProgramAthletesService } from '../../programs/services/program-athletes.service';
import { ProgramAccessGuard } from '../../programs/guards/program-access.guard';
import { AthleteRequestsService } from '../../programs/services/athlete-requests.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

@Controller('events/:eventId/programs/:programId/teams')
// Staff (admin/assessor) ou a própria conta Programa, ver ProgramAccessGuard.
@UseGuards(JwtAuthGuard, ProgramAccessGuard)
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly programAthletesService: ProgramAthletesService,
    private readonly athleteRequestsService: AthleteRequestsService,
  ) {}

  // Conta Programa não muda as categorias de atleta com inscrição aprovada
  // (AthleteRequestsService.assertApprovedCategoriesKept); o produtor pode.
  private async assertKept(
    req: AuthenticatedRequest,
    programId: string,
    change: Parameters<
      AthleteRequestsService['assertApprovedCategoriesKept']
    >[1],
  ): Promise<void> {
    if (req.user.role !== UserRole.PROGRAM) return;
    await this.athleteRequestsService.assertApprovedCategoriesKept(
      programId,
      change,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Body() dto: CreateTeamDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.teamsService.create(eventId, programId, dto, req.user.userId);
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
    @Req() req: AuthenticatedRequest,
  ) {
    return this.teamsService.update(
      eventId,
      programId,
      teamId,
      dto,
      req.user.userId,
    );
  }

  @Delete(':teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('teamId') teamId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertKept(req, programId, (entries) =>
      entries.filter((e) => e.teamId !== teamId),
    );
    return this.teamsService.remove(
      eventId,
      programId,
      teamId,
      req.user.userId,
    );
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
      dto.categoryIds,
    );
  }

  @Delete(':teamId/categories/:categoryId')
  async removeCategory(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('teamId') teamId: string,
    @Param('categoryId') categoryId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertKept(req, programId, (entries) =>
      entries.filter(
        (e) => !(e.teamId === teamId && e.categoryId === categoryId),
      ),
    );
    return this.teamsService.removeCategory(
      eventId,
      programId,
      teamId,
      categoryId,
    );
  }

  // Atletas que competem por esta equipe nesta categoria (lista completa).
  @Put(':teamId/categories/:categoryId/athletes')
  async setCategoryAthletes(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('teamId') teamId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: SetTeamCategoryAthletesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertKept(req, programId, (entries, lockedIds) => [
      ...entries.filter(
        (e) => !(e.teamId === teamId && e.categoryId === categoryId),
      ),
      ...dto.athleteIds
        .filter((id) => lockedIds.has(id))
        .map((athleteId) => ({ athleteId, teamId, categoryId })),
    ]);
    return this.programAthletesService.setTeamCategoryAthletes(
      eventId,
      programId,
      teamId,
      categoryId,
      dto.athleteIds,
    );
  }
}

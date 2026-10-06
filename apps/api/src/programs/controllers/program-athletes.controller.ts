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
import { ProgramAthletesService } from '../services/program-athletes.service';
import { CreateProgramAthleteDto } from '../dto/create-program-athlete.dto';
import { UpdateProgramAthleteDto } from '../dto/update-program-athlete.dto';
import { SetAthleteEntriesDto } from '../dto/set-athlete-entries.dto';
import { ProgramAccessGuard } from '../guards/program-access.guard';
import { ProgramAthleteRequirementsService } from '../services/program-athlete-requirements.service';
import { SetRequirementValueDto } from '../dto/set-requirement-value.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Atletas inscritos pelo programa no evento (ProgramAthlete).
@Controller('events/:eventId/programs/:programId/athletes')
// Staff (admin/assessor) ou a própria conta Programa, ver ProgramAccessGuard.
@UseGuards(JwtAuthGuard, ProgramAccessGuard)
export class ProgramAthletesController {
  constructor(
    private readonly athletesService: ProgramAthletesService,
    private readonly requirementsService: ProgramAthleteRequirementsService,
  ) {}

  // Dados pedidos na inscrição (aba Configurações) e as respostas do atleta.
  @Get(':athleteId/requirements')
  listRequirements(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('athleteId') athleteId: string,
  ) {
    return this.requirementsService.list(eventId, programId, athleteId);
  }

  @Put(':athleteId/requirements/:requirementId')
  setRequirement(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('athleteId') athleteId: string,
    @Param('requirementId') requirementId: string,
    @Body() dto: SetRequirementValueDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.requirementsService.set(
      eventId,
      programId,
      athleteId,
      requirementId,
      dto.value ?? null,
      req.user.userId,
    );
  }

  @Get()
  findAll(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
  ) {
    return this.athletesService.list(eventId, programId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Body() dto: CreateProgramAthleteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.athletesService.create(
      eventId,
      programId,
      dto,
      req.user.userId,
    );
  }

  @Patch(':athleteId')
  update(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('athleteId') athleteId: string,
    @Body() dto: UpdateProgramAthleteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.athletesService.update(
      eventId,
      programId,
      athleteId,
      dto,
      req.user.userId,
    );
  }

  @Delete(':athleteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('athleteId') athleteId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.athletesService.remove(
      eventId,
      programId,
      athleteId,
      req.user.userId,
    );
  }

  @Put(':athleteId/entries')
  setEntries(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('athleteId') athleteId: string,
    @Body() dto: SetAthleteEntriesDto,
  ) {
    return this.athletesService.setAthleteEntries(
      eventId,
      programId,
      athleteId,
      dto.entries,
    );
  }
}

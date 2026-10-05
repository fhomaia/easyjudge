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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Atletas inscritos pelo programa no evento (ProgramAthlete). Mesmos
// guards do ProgramsController: só admin/assessor do evento.
@Controller('events/:eventId/programs/:programId/athletes')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
@EventRoles(EventMemberRole.ADMIN, EventMemberRole.ASSESSOR)
export class ProgramAthletesController {
  constructor(private readonly athletesService: ProgramAthletesService) {}

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

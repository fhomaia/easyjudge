import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ProgramAthletesService } from '../services/program-athletes.service';
import { CreateProgramAthleteDto } from '../dto/create-program-athlete.dto';
import { UpdateProgramAthleteDto } from '../dto/update-program-athlete.dto';
import { SetAthleteEntriesDto } from '../dto/set-athlete-entries.dto';
import {
  DocumentWrite,
  ProgramAccessGuard,
} from '../guards/program-access.guard';
import { ContestDocumentDto } from '../dto/contest-document.dto';
import {
  ATHLETE_DOCUMENT_HARD_MAX_FILES,
  athleteDocumentUploadOptions,
} from '../../common/config/athlete-document-upload.config';
import { UserRole } from '../../common/enums/user-role.enum';
import type { RequirementActor } from '../services/program-athlete-requirements.service';

// O guard só deixa passar staff ou a conta Programa dona.
const actorOf = (req: AuthenticatedRequest): RequirementActor =>
  req.user.role === UserRole.PROGRAM ? 'program' : 'staff';
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
    @Req() req: AuthenticatedRequest,
  ) {
    return this.requirementsService.list(
      eventId,
      programId,
      athleteId,
      actorOf(req),
    );
  }

  // Documentos (2026-10-06): arquivos no bucket privado.
  @Post(':athleteId/documents/:requirementId')
  @DocumentWrite()
  @UseInterceptors(
    FilesInterceptor(
      'files',
      ATHLETE_DOCUMENT_HARD_MAX_FILES,
      athleteDocumentUploadOptions,
    ),
  )
  setDocument(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('athleteId') athleteId: string,
    @Param('requirementId') requirementId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: AuthenticatedRequest,
  ) {
    return this.requirementsService.setDocument(
      eventId,
      programId,
      athleteId,
      requirementId,
      { files },
      req.user.userId,
      actorOf(req),
    );
  }

  @Delete(':athleteId/documents/:requirementId')
  @DocumentWrite()
  removeDocument(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('athleteId') athleteId: string,
    @Param('requirementId') requirementId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.requirementsService.removeDocument(
      eventId,
      programId,
      athleteId,
      requirementId,
      actorOf(req),
    );
  }

  @Get(':athleteId/documents/:requirementId/files/:index')
  documentFile(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('athleteId') athleteId: string,
    @Param('requirementId') requirementId: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.requirementsService.streamDocumentFile(
      eventId,
      programId,
      athleteId,
      requirementId,
      index,
    );
  }

  // Só o produtor contesta.
  @Post(':athleteId/documents/:requirementId/contest')
  contestDocument(
    @Param('eventId') eventId: string,
    @Param('programId') programId: string,
    @Param('athleteId') athleteId: string,
    @Param('requirementId') requirementId: string,
    @Body() dto: ContestDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (actorOf(req) !== 'staff') {
      throw new ForbiddenException('Só o organizador contesta documentos.');
    }
    return this.requirementsService.contestDocument(
      eventId,
      programId,
      athleteId,
      requirementId,
      dto.reason,
      req.user.userId,
    );
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
      actorOf(req),
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

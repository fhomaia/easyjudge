import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';
import { UserRole } from '../../common/enums/user-role.enum';
import {
  ATHLETE_DOCUMENT_HARD_MAX_FILES,
  athleteDocumentUploadOptions,
} from '../../common/config/athlete-document-upload.config';
import { SetRequirementValueDto } from '../dto/set-requirement-value.dto';
import { AthleteRegistrationService } from '../services/athlete-registration.service';
import { ProgramAthleteRequirementsService } from '../services/program-athlete-requirements.service';

// "Inscreva-se aqui" do atleta (2026-10-06). Acesso pela conta cujo email
// é o do atleta do evento (AthleteRegistrationService.resolve), qualquer
// tipo de conta menos Programa.
@Controller()
@UseGuards(JwtAuthGuard)
export class AthleteRegistrationController {
  constructor(
    private readonly registrationService: AthleteRegistrationService,
    private readonly requirementsService: ProgramAthleteRequirementsService,
  ) {}

  @Get('me/registrations')
  listMine(@Req() req: AuthenticatedRequest) {
    if (req.user.role === UserRole.PROGRAM) return [];
    return this.registrationService.listMine(req.user.userId);
  }

  @Get('events/:eventId/my-registration')
  get(@Param('eventId') eventId: string, @Req() req: AuthenticatedRequest) {
    this.assertAthleteAccount(req);
    return this.registrationService.getForEvent(req.user.userId, eventId);
  }

  @Put('events/:eventId/my-registration/:athleteId/requirements/:requirementId')
  async setRequirement(
    @Param('eventId') eventId: string,
    @Param('athleteId') athleteId: string,
    @Param('requirementId') requirementId: string,
    @Body() dto: SetRequirementValueDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const { programId, athleteId: id } = await this.resolve(
      req,
      eventId,
      athleteId,
      true,
    );
    return this.requirementsService.set(
      eventId,
      programId,
      id,
      requirementId,
      dto.value ?? null,
      req.user.userId,
      'athlete',
    );
  }

  // Arquivos novos (`files`) e/ou documentos da biblioteca
  // (`libraryDocumentIds`, lista separada por vírgula, por ser multipart).
  @Post('events/:eventId/my-registration/:athleteId/documents/:requirementId')
  @UseInterceptors(
    FilesInterceptor(
      'files',
      ATHLETE_DOCUMENT_HARD_MAX_FILES,
      athleteDocumentUploadOptions,
    ),
  )
  async setDocument(
    @Param('eventId') eventId: string,
    @Param('athleteId') athleteId: string,
    @Param('requirementId') requirementId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('libraryDocumentIds') libraryDocumentIds: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const { programId, athleteId: id } = await this.resolve(
      req,
      eventId,
      athleteId,
      true,
    );
    return this.requirementsService.setDocument(
      eventId,
      programId,
      id,
      requirementId,
      {
        files,
        libraryDocumentIds: (libraryDocumentIds ?? '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      },
      req.user.userId,
      'athlete',
    );
  }

  @Delete('events/:eventId/my-registration/:athleteId/documents/:requirementId')
  async removeDocument(
    @Param('eventId') eventId: string,
    @Param('athleteId') athleteId: string,
    @Param('requirementId') requirementId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const { programId, athleteId: id } = await this.resolve(
      req,
      eventId,
      athleteId,
      true,
    );
    return this.requirementsService.removeDocument(
      eventId,
      programId,
      id,
      requirementId,
      'athlete',
    );
  }

  @Get(
    'events/:eventId/my-registration/:athleteId/documents/:requirementId/files/:index',
  )
  async documentFile(
    @Param('eventId') eventId: string,
    @Param('athleteId') athleteId: string,
    @Param('requirementId') requirementId: string,
    @Param('index', ParseIntPipe) index: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const { programId, athleteId: id } = await this.resolve(
      req,
      eventId,
      athleteId,
      false,
    );
    return this.requirementsService.streamDocumentFile(
      eventId,
      programId,
      id,
      requirementId,
      index,
    );
  }

  @Post('events/:eventId/my-registration/:athleteId/submit')
  async submit(
    @Param('eventId') eventId: string,
    @Param('athleteId') athleteId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const { programId, athleteId: id } = await this.resolve(
      req,
      eventId,
      athleteId,
      true,
    );
    return this.requirementsService.athleteSubmit(eventId, programId, id);
  }

  // Salvar algo cria o atleta do evento quando o programa ainda não o
  // pôs em nenhuma categoria (ver AthleteRegistrationService.resolve).
  private resolve(
    req: AuthenticatedRequest,
    eventId: string,
    athleteId: string,
    create: boolean,
  ) {
    this.assertAthleteAccount(req);
    return this.registrationService.resolve(
      req.user.userId,
      eventId,
      athleteId,
      { create },
    );
  }

  private assertAthleteAccount(req: AuthenticatedRequest) {
    if (req.user.role === UserRole.PROGRAM) {
      throw new ForbiddenException(
        'Conta Programa não se inscreve como atleta.',
      );
    }
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProgramRegistrationService } from '../services/program-registration.service';
import { AthleteRequestsService } from '../services/athlete-requests.service';
import {
  ApproveAthleteRequestDto,
  RejectAthleteRequestDto,
  RequestAthleteChangesDto,
} from '../dto/athlete-request.dto';
import {
  CreateRegistrationRequestDto,
  MoveTeamCategoryDto,
  RegisterProgramDto,
  SetRegistrationAthleteEntriesDto,
  SetRegistrationPairAthletesDto,
  SetRegistrationTeamCategoriesDto,
} from '../dto/register-program.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Inscrição pelo próprio programa, ver ProgramRegistrationService.
@Controller('events/:eventId/registration')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PROGRAM)
export class ProgramRegistrationController {
  constructor(
    private readonly registrationService: ProgramRegistrationService,
    private readonly athleteRequestsService: AthleteRequestsService,
  ) {}

  // Pedidos de inscrição de atletas (2026-10-10).
  @Get('athlete-requests')
  listAthleteRequests(
    @Param('eventId') eventId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.athleteRequestsService.listForProgram(eventId, req.user.userId);
  }

  @Post('athlete-requests/:requestId/approve')
  approveAthleteRequest(
    @Param('eventId') eventId: string,
    @Param('requestId') requestId: string,
    @Body() dto: ApproveAthleteRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.athleteRequestsService.approve(
      eventId,
      req.user.userId,
      requestId,
      dto.entries,
    );
  }

  @Post('athlete-requests/:requestId/request-changes')
  requestAthleteChanges(
    @Param('eventId') eventId: string,
    @Param('requestId') requestId: string,
    @Body() dto: RequestAthleteChangesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.athleteRequestsService.requestChanges(
      eventId,
      req.user.userId,
      requestId,
      dto.message,
    );
  }

  @Post('athlete-requests/:requestId/reject')
  rejectAthleteRequest(
    @Param('eventId') eventId: string,
    @Param('requestId') requestId: string,
    @Body() dto: RejectAthleteRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.athleteRequestsService.reject(
      eventId,
      req.user.userId,
      requestId,
      dto.message,
    );
  }

  // Pedido de correção de inscrição aprovada: mantém como estava.
  @Post('athlete-requests/:requestId/keep')
  keepAthleteRequest(
    @Param('eventId') eventId: string,
    @Param('requestId') requestId: string,
    @Body() dto: RejectAthleteRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.athleteRequestsService.keep(
      eventId,
      req.user.userId,
      requestId,
      dto.message,
    );
  }

  @Get()
  get(@Param('eventId') eventId: string, @Req() req: AuthenticatedRequest) {
    return this.registrationService.get(eventId, req.user.userId);
  }

  @Post()
  register(
    @Param('eventId') eventId: string,
    @Body() dto: RegisterProgramDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.registrationService.register(eventId, req.user.userId, dto);
  }

  @Post('submit')
  submit(@Param('eventId') eventId: string, @Req() req: AuthenticatedRequest) {
    return this.registrationService.submit(eventId, req.user.userId);
  }

  @Post('requests')
  createRequest(
    @Param('eventId') eventId: string,
    @Body() dto: CreateRegistrationRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.registrationService.createRequest(
      eventId,
      req.user.userId,
      dto.type,
      dto.message ?? '',
    );
  }

  @Put('teams/:teamId/categories')
  setTeamCategories(
    @Param('eventId') eventId: string,
    @Param('teamId') teamId: string,
    @Body() dto: SetRegistrationTeamCategoriesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.registrationService.setTeamCategories(
      eventId,
      req.user.userId,
      teamId,
      dto.categoryIds,
    );
  }

  @Post('teams/:teamId/categories/:categoryId/move')
  moveTeamCategory(
    @Param('eventId') eventId: string,
    @Param('teamId') teamId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: MoveTeamCategoryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.registrationService.moveTeamCategory(
      eventId,
      req.user.userId,
      teamId,
      categoryId,
      dto.toCategoryId,
    );
  }

  @Put('teams/:teamId/categories/:categoryId/athletes')
  setPairAthletes(
    @Param('eventId') eventId: string,
    @Param('teamId') teamId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: SetRegistrationPairAthletesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.registrationService.setPairAthletes(
      eventId,
      req.user.userId,
      teamId,
      categoryId,
      dto.linkIds,
      dto.keepAthleteIds,
    );
  }

  // "Inscrever atleta": cria o atleta do evento (dados e documentos antes
  // das categorias) e, no fim, grava as categorias conferindo o que falta.
  @Post('athletes/:linkId/prepare')
  prepareAthlete(
    @Param('eventId') eventId: string,
    @Param('linkId') linkId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.registrationService.prepareAthlete(
      eventId,
      req.user.userId,
      linkId,
    );
  }

  @Post('athletes/:linkId/enroll')
  enrollAthlete(
    @Param('eventId') eventId: string,
    @Param('linkId') linkId: string,
    @Body() dto: SetRegistrationAthleteEntriesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.registrationService.enrollAthlete(
      eventId,
      req.user.userId,
      linkId,
      dto.entries,
    );
  }

  @Put('athletes/:linkId/entries')
  setAthleteEntries(
    @Param('eventId') eventId: string,
    @Param('linkId') linkId: string,
    @Body() dto: SetRegistrationAthleteEntriesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.registrationService.setAthleteEntries(
      eventId,
      req.user.userId,
      linkId,
      dto.entries,
    );
  }
}

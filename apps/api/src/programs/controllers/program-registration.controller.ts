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
  constructor(private readonly registrationService: ProgramRegistrationService) {}

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

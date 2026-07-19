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
import { JudgesService } from '../services/judges.service';
import { CreateJudgeParticipationDto } from '../dto/create-judge-participation.dto';
import { UpdateJudgeParticipationDto } from '../dto/update-judge-participation.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Assessor tem CRUD completo aqui (mesmo não podendo mexer em
// acessos/pessoas no roster do evento, ver EventStaffController) —
// cadastro de jurados é uma exceção explícita pedida pelo usuário.
@Controller('events/:eventId/judges')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
@EventRoles(EventMemberRole.ADMIN, EventMemberRole.ASSESSOR)
export class JudgesController {
  constructor(private readonly judgesService: JudgesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateJudgeParticipationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.judgesService.create(eventId, dto, req.user.userId);
  }

  @Get()
  findAll(@Param('eventId') eventId: string) {
    return this.judgesService.findAllForEvent(eventId);
  }

  @Get(':id')
  findOne(@Param('eventId') eventId: string, @Param('id') id: string) {
    return this.judgesService.findOneForEvent(eventId, id);
  }

  @Patch(':id')
  update(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateJudgeParticipationDto,
  ) {
    return this.judgesService.update(eventId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('eventId') eventId: string, @Param('id') id: string) {
    return this.judgesService.remove(eventId, id);
  }
}

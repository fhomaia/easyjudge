import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ScoringTemplatesService } from '../services/scoring-templates.service';
import { AddEventScoringTemplateDto } from '../dto/add-event-scoring-template.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Curadoria de "quais sistemas de pontuação valem pra este evento"
// (tela de Regulamento) — só admin/assessor mexe, mesmo par de papéis
// que já guarda a própria página no front (useEventSetupGuard).
@Controller('events/:eventId/scoring-templates')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
@EventRoles(EventMemberRole.ADMIN, EventMemberRole.ASSESSOR)
export class EventScoringTemplatesController {
  constructor(
    private readonly scoringTemplatesService: ScoringTemplatesService,
  ) {}

  @Get()
  list(
    @Param('eventId') eventId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringTemplatesService.listSelectedForEvent(
      eventId,
      req.user.userId,
    );
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  add(
    @Param('eventId') eventId: string,
    @Body() dto: AddEventScoringTemplateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringTemplatesService.addToEventSelection(
      eventId,
      dto.templateId,
      req.user.userId,
    );
  }

  @Delete(':templateId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('eventId') eventId: string,
    @Param('templateId') templateId: string,
  ) {
    return this.scoringTemplatesService.removeFromEventSelection(
      eventId,
      templateId,
    );
  }
}

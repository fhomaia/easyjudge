import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventFeedbackService } from '../services/event-feedback.service';
import { EventFeedbackDto } from '../dto/feedback.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

const ANY_ROLE = Object.values(EventMemberRole);

@Controller('events/:eventId/feedback')
@UseGuards(JwtAuthGuard, EventMemberGuard)
export class EventFeedbackController {
  constructor(private readonly feedbackService: EventFeedbackService) {}

  // Lista pro produtor (com nome de quem avaliou, decisão do usuário).
  @Get()
  @EventRoles(EventMemberRole.ADMIN, EventMemberRole.ASSESSOR)
  list(@Param('eventId') eventId: string) {
    return this.feedbackService.listForEvent(eventId);
  }

  @Get('me')
  @EventRoles(...ANY_ROLE)
  getMine(@Param('eventId') eventId: string, @Req() req: AuthenticatedRequest) {
    return this.feedbackService.getMine(eventId, req.user.userId);
  }

  @Put('me')
  @EventRoles(...ANY_ROLE)
  saveMine(
    @Param('eventId') eventId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: EventFeedbackDto,
  ) {
    return this.feedbackService.saveMine(eventId, req.user.userId, dto);
  }
}

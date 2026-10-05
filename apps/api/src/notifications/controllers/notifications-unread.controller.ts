import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from '../services/notifications.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Não lidas de todos os eventos do usuário logado (selo nos cards da Home
// e no item "Eventos" do menu).
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsUnreadController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('unread')
  unread(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.unreadCountsForUser(req.user.userId);
  }
}

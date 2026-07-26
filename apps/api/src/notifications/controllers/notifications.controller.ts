import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from '../services/notifications.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// Só JwtAuthGuard (sem RolesGuard/EventMemberGuard) — qualquer papel de
// evento pode ver suas próprias notificações, o filtro de audiência
// (ALL/STAFF) já é resolvido dentro do service a partir do papel do
// usuário. Usar EventMemberGuard aqui exigiria importar EventsModule
// (dono do guard) em NotificationsModule, criando o ciclo que o
// TypeOrmModule.forFeature direto em NotificationsModule foi desenhado
// pra evitar — resolveMemberOrThrow no service já barra (403) quem não
// tem EventMember nenhum pra este evento.
@Controller('events/:eventId/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Param('eventId') eventId: string, @Req() req: AuthenticatedRequest) {
    return this.notificationsService.listForUser(eventId, req.user.userId);
  }

  @Post('seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  markSeen(
    @Param('eventId') eventId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.markSeen(eventId, req.user.userId);
  }
}

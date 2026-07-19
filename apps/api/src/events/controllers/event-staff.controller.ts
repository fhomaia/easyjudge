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
import { EventStaffService } from '../services/event-staff.service';
import { CreateEventStaffMemberDto } from '../dto/create-event-staff-member.dto';
import { UpdateEventStaffMemberDto } from '../dto/update-event-staff-member.dto';
import { EventMemberGuard } from '../guards/event-member.guard';
import { EventRoles } from '../decorators/event-roles.decorator';
import { EventMemberRole } from '../enums/event-member-role.enum';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

// "Gerenciar acessos" — roster de quem faz parte do evento e com qual
// papel. Leitura é admin+assessor; toda escrita (criar/editar papéis/
// remover) é admin-only, inclusive pra jurados (que continuam sendo
// geridos, como cadastro, pelo Painel de Jurados — ver JudgesController,
// que aceita assessor).
@Controller('events/:eventId/staff')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
export class EventStaffController {
  constructor(private readonly eventStaffService: EventStaffService) {}

  @Get()
  @EventRoles(EventMemberRole.ADMIN, EventMemberRole.ASSESSOR)
  list(@Param('eventId') eventId: string) {
    return this.eventStaffService.list(eventId);
  }

  @Post()
  @EventRoles(EventMemberRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventStaffMemberDto,
  ) {
    return this.eventStaffService.create(eventId, dto);
  }

  @Patch(':memberId')
  @EventRoles(EventMemberRole.ADMIN)
  updateRoles(
    @Param('eventId') eventId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateEventStaffMemberDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventStaffService.updateRoles(
      eventId,
      memberId,
      dto,
      req.user.userId,
    );
  }

  @Delete(':memberId')
  @EventRoles(EventMemberRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('eventId') eventId: string,
    @Param('memberId') memberId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventStaffService.remove(eventId, memberId, req.user.userId);
  }
}

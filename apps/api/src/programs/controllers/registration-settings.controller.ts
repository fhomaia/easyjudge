import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { RegistrationSettingsService } from '../services/registration-settings.service';
import { UpdateRegistrationSettingsDto } from '../dto/update-registration-settings.dto';
import { REQUIREMENT_PRESETS } from '../registration-requirements';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';

// Configuração da inscrição (aba Configurações da tela de Inscrições):
// dados e documentos pedidos aos atletas. Admin/assessor do evento.
@Controller('events/:eventId/registration-settings')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
@EventRoles(EventMemberRole.ADMIN, EventMemberRole.ASSESSOR)
export class RegistrationSettingsController {
  constructor(private readonly settingsService: RegistrationSettingsService) {}

  @Get()
  async get(@Param('eventId') eventId: string) {
    return {
      ...(await this.settingsService.getForEvent(eventId)),
      // Sugestões disponíveis (a tela mostra as que ainda não foram usadas).
      presets: Object.values(REQUIREMENT_PRESETS),
    };
  }

  @Put()
  update(
    @Param('eventId') eventId: string,
    @Body() dto: UpdateRegistrationSettingsDto,
  ) {
    return this.settingsService.update(eventId, dto);
  }
}

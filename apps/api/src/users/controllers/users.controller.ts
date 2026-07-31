import {
  Controller,
  Get,
  NotFoundException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    // Só custa a query extra pra quem de fato pode ser exibido como
    // "Espectador" (ver getAccountLabel no frontend) — outros papéis
    // sempre voltam false.
    const hasConfirmedAthleteLink =
      user.role === UserRole.ATHLETE
        ? await this.usersService.hasConfirmedAthleteLink(user.id)
        : false;
    return {
      id: user.id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      hasConfirmedAthleteLink,
    };
  }
}

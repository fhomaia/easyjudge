import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../../users/services/users.service';
import { MailService } from '../../auth/services/mail.service';

@Injectable()
export class SupportService {
  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {}

  async sendMessage(userId: string, message: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    await this.mailService.sendSupportMessage(
      {
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        role: user.role,
      },
      message,
    );
  }
}

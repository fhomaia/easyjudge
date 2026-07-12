import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  /**
   * TODO: substituir por um provider real (Resend, SendGrid, SES etc).
   * Mantendo a interface do método igual, o resto do auth.service
   * não precisa mudar quando trocar o provider.
   */
  async sendVerificationCode(email: string, code: string): Promise<void> {
    this.logger.log(`[STUB] Enviando código ${code} para ${email}`);
    // await this.provider.send({ to: email, subject: 'Seu código easyJudge', ... })
  }
}

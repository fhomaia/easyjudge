import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly fromAddress: string;
  private readonly overrideTo: string | null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromAddress =
      this.configService.get<string>('EMAIL_FROM') ??
      'easyJudge <onboarding@resend.dev>';
    // Enquanto o domínio não é verificado no Resend, o sandbox só entrega
    // pro email da própria conta — redireciona tudo pra lá (o corpo do
    // email mostra qual foi o cadastro de verdade). Remover essa variável
    // quando um domínio próprio estiver verificado.
    this.overrideTo =
      this.configService.get<string>('EMAIL_OVERRIDE_TO') ?? null;

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      // Sem RESEND_API_KEY configurada (ex: clone novo do repo sem .env
      // preenchido) — cai pro comportamento antigo de só logar, pra não
      // travar o fluxo de dev local.
      this.resend = null;
      this.logger.warn(
        'RESEND_API_KEY não configurada — MailService vai só logar o código (modo stub).',
      );
    }
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[STUB] Enviando código ${code} para ${email}`);
      return;
    }

    const recipient = this.overrideTo ?? email;
    const redirected = recipient !== email;

    const { error } = await this.resend.emails.send({
      from: this.fromAddress,
      to: recipient,
      subject: redirected
        ? `[teste: ${email}] Seu código de verificação easyJudge`
        : 'Seu código de verificação easyJudge',
      html: redirected
        ? `<p>Cadastro de teste para: <strong>${email}</strong></p><p>Seu código de verificação é: <strong>${code}</strong></p><p>Ele expira em 15 minutos.</p>`
        : `<p>Seu código de verificação é: <strong>${code}</strong></p><p>Ele expira em 15 minutos.</p>`,
    });

    if (error) {
      this.logger.error(
        `Falha ao enviar email para ${recipient}: ${error.message}`,
      );
      throw new Error('Não foi possível enviar o email de verificação.');
    }

    this.logger.log(
      redirected
        ? `Código de verificação enviado para ${recipient} (cadastro de ${email})`
        : `Código de verificação enviado para ${recipient}`,
    );
  }
}

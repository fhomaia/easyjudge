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
      'Cheer Cup <onboarding@resend.dev>';
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
        ? `[teste: ${email}] Seu código de verificação Cheer Cup`
        : 'Seu código de verificação Cheer Cup',
      html: buildVerificationEmailHtml(
        code,
        redirected ? email : null,
      ),
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

// Domínio de produção fixo (não config de ambiente): o logo precisa ser
// uma URL pública de verdade, buscada pelo cliente de email de quem
// recebe — nunca resolve localhost, então não faz sentido variar por
// VITE_API_URL/etc. como o resto do app faz.
const LOGO_URL = 'https://cheercup.com.br/logo.png';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Template do email de verificação — identidade visual da marca (logo +
// paleta navy/azul/amarelo, ver apps/web/src/index.css) em vez do texto
// solto anterior. Estilos inline (não <style> em <head>) e layout em
// tabela: é o que sobrevive de forma previsível em clientes de email
// (Outlook desktop em particular ignora CSS fora de atributo `style`).
// `testRecipientEmail` só é preenchido quando EMAIL_OVERRIDE_TO está
// ativo (sandbox sem domínio verificado) — mostra pra quem cadastrou de
// teste qual conta de verdade gerou aquele código.
function buildVerificationEmailHtml(
  code: string,
  testRecipientEmail: string | null,
): string {
  const testBanner = testRecipientEmail
    ? `<tr><td style="padding:0 40px;">
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf3e2;border:1px solid #f7a828;border-radius:8px;margin:24px 0 0;">
           <tr><td style="padding:12px 16px;font-size:13px;color:#14293d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
             Cadastro de teste para: <strong>${escapeHtml(testRecipientEmail)}</strong>
           </td></tr>
         </table>
       </td></tr>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f4f6f8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td align="center" style="background:#14293d;padding:32px;">
                <img src="${LOGO_URL}" width="64" height="64" alt="Cheer Cup" style="display:block;border-radius:9999px;width:64px;height:64px;" />
              </td>
            </tr>
            ${testBanner}
            <tr>
              <td style="padding:40px 40px 8px;text-align:center;">
                <h1 style="margin:0 0 12px;font-size:20px;color:#14293d;">Confirme seu cadastro</h1>
                <p style="margin:0;font-size:14px;line-height:1.5;color:#3d6485;">
                  Use o código abaixo para confirmar seu email e continuar seu cadastro na Cheer Cup.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf3e2;border:1px solid #f7a828;border-radius:8px;">
                  <tr>
                    <td align="center" style="padding:20px;">
                      <span style="font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#14293d;">${escapeHtml(code)}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 40px;text-align:center;">
                <p style="margin:0;font-size:13px;line-height:1.5;color:#8a97a6;">
                  Esse código expira em 15 minutos. Se você não pediu esse cadastro, pode ignorar este email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px;background:#f4f6f8;border-top:1px solid #e7ebee;text-align:center;">
                <span style="font-size:12px;color:#8a97a6;">Cheer Cup</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

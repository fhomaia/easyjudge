import { Module } from '@nestjs/common';
import { MailService } from './services/mail.service';

// MailService sozinho (só depende de ConfigService, global), pra módulos
// que não podem importar AuthModule sem ciclo (ex.: ProgramsModule, que o
// AuthModule importa).
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}

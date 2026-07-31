import { Module } from '@nestjs/common';
import { SupportController } from './controllers/support.controller';
import { SupportService } from './services/support.service';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

// Importa AuthModule só pra ter acesso ao MailService (exportado de lá,
// ver auth.module.ts) — mesmo raciocínio já usado em outros domínios de
// reaproveitar o service do módulo dono em vez de duplicar
// configuração/instância do Resend.
@Module({
  imports: [UsersModule, AuthModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { MailService } from './services/mail.service';
import { EmailVerification } from './entities/email-verification.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { ProgramsModule } from '../programs/programs.module';
import { JudgesModule } from '../judges/judges.module';
import { EventsModule } from '../events/events.module';
import { AthletesModule } from '../athletes/athletes.module';

@Module({
  imports: [
    UsersModule,
    ProgramsModule,
    JudgesModule,
    EventsModule,
    AthletesModule,
    TypeOrmModule.forFeature([EmailVerification]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, MailService, JwtStrategy],
  // MailService exportado além de AuthService: SupportModule reusa a
  // mesma instância (config do Resend já resolvida) pro botão "Preciso
  // de ajuda", em vez de duplicar a configuração.
  exports: [AuthService, MailService],
})
export class AuthModule {}

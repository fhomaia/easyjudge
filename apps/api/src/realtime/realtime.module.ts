import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventMember } from '../events/entities/event-member.entity';
import { EventsGateway } from './events.gateway';

// `EventMember` aqui só pra o Gateway conferir membership no `join`
// (mesmo repositório usado por `EventMemberGuard`/`EventsService`) —
// não importa `EventsModule` inteiro, mesmo padrão já usado por
// `NotificationsModule` pra evitar ciclo (`EventsModule` também
// precisa deste módulo, indiretamente via `EventEmitter2` global, pra
// emitir `event.status_changed`).
@Module({
  imports: [
    TypeOrmModule.forFeature([EventMember]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [EventsGateway],
})
export class RealtimeModule {}

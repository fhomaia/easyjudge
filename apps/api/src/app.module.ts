import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { CategoriesModule } from './categories/categories.module';
import { ProgramsModule } from './programs/programs.module';
import { JudgesModule } from './judges/judges.module';
import { TeamsModule } from './teams/teams.module';
import { ScoringTemplatesModule } from './scoring-templates/scoring-templates.module';
import { RegulationsModule } from './regulations/regulations.module';
import { JudgingModule } from './judging/judging.module';
import { ScheduleModule } from './schedule/schedule.module';
import { ScoringModule } from './scoring/scoring.module';
import { AthletesModule } from './athletes/athletes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RealtimeModule } from './realtime/realtime.module';
import { CommonModule } from './common/common.module';
import { SupportModule } from './support/support.module';
import { EventMetricsModule } from './event-metrics/event-metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: false,
      // Sem isso, o driver `pg` cai no padrão de só 10 conexões — achado
      // real com teste de carga (packages/load-test, 2026-09-23):
      // 200 espectadores lendo ao mesmo tempo botavam a leitura REST na
      // casa de 4-7s (fila pro pool), enquanto socket/broadcast ficavam
      // normais (~800ms, só rede) — sinal claro de fila de conexão, não
      // CPU/rede. 20 é modesto o bastante pra não estourar limite de
      // conexão do Neon mesmo sem usar o endpoint com pooler dele.
      extra: { max: 20 },
    }),
    // Global (sem precisar importar em cada módulo) — desacopla quem
    // dispara um efeito (NotificationsService/EventsService) de quem
    // reage a ele (RealtimeModule/EventsGateway), evitando import
    // circular (ver comentário em realtime.module.ts).
    EventEmitterModule.forRoot(),
    // Global também — StorageService (upload de logo/documento pro R2,
    // com fallback pra disco local) é usado por 3 domínios diferentes
    // (events, programs, regulations) sem relação entre si.
    CommonModule,
    AuthModule,
    UsersModule,
    EventsModule,
    CategoriesModule,
    ProgramsModule,
    JudgesModule,
    TeamsModule,
    ScoringTemplatesModule,
    RegulationsModule,
    JudgingModule,
    ScheduleModule,
    ScoringModule,
    AthletesModule,
    NotificationsModule,
    RealtimeModule,
    SupportModule,
    EventMetricsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

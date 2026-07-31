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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

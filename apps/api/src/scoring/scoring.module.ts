import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoreEvent } from './entities/score-event.entity';
import { Category } from '../categories/entities/category.entity';
import { Team } from '../teams/entities/team.entity';
import { ScoringController } from './controllers/scoring.controller';
import { AdminScoringController } from './controllers/admin-scoring.controller';
import { TeamScoringController } from './controllers/team-scoring.controller';
import { ResultsController } from './controllers/results.controller';
import { AthleteScoringController } from './controllers/athlete-scoring.controller';
import { WithdrawalController } from './controllers/withdrawal.controller';
import { ScoringService } from './services/scoring.service';
import { EventsModule } from '../events/events.module';
import { JudgesModule } from '../judges/judges.module';
import { JudgingModule } from '../judging/judging.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { ScoringTemplatesModule } from '../scoring-templates/scoring-templates.module';
import { RegulationsModule } from '../regulations/regulations.module';
import { ProgramsModule } from '../programs/programs.module';
import { AthletesModule } from '../athletes/athletes.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScoreEvent, Category, Team]),
    EventsModule,
    JudgesModule,
    JudgingModule,
    ScheduleModule,
    ScoringTemplatesModule,
    RegulationsModule,
    ProgramsModule,
    AthletesModule,
    NotificationsModule,
  ],
  controllers: [
    ScoringController,
    AdminScoringController,
    TeamScoringController,
    ResultsController,
    AthleteScoringController,
    WithdrawalController,
  ],
  providers: [ScoringService],
})
export class ScoringModule {}

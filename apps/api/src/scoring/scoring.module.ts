import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoreEvent } from './entities/score-event.entity';
import { Category } from '../categories/entities/category.entity';
import { Team } from '../teams/entities/team.entity';
import { ScheduleEntry } from '../schedule/entities/schedule-entry.entity';
import { ScoringTemplate } from '../scoring-templates/entities/scoring-template.entity';
import { ScoringController } from './controllers/scoring.controller';
import { AdminScoringController } from './controllers/admin-scoring.controller';
import { TeamScoringController } from './controllers/team-scoring.controller';
import { ResultsController } from './controllers/results.controller';
import { AthleteScoringController } from './controllers/athlete-scoring.controller';
import { WithdrawalController } from './controllers/withdrawal.controller';
import { ScoringService } from './services/scoring.service';
import { ReleasesService } from './services/releases.service';
import { CategoryDayRelease } from './entities/category-day-release.entity';
import { EventsModule } from '../events/events.module';
import { JudgesModule } from '../judges/judges.module';
import { JudgingModule } from '../judging/judging.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { ScoringTemplatesModule } from '../scoring-templates/scoring-templates.module';
import { ProgramsModule } from '../programs/programs.module';
import { AthletesModule } from '../athletes/athletes.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    // ScoringTemplate aqui (repo direto, não o módulo) só pra
    // ScoringService resolver as regras de dedução de uma categoria via
    // category.scoringTemplateId — mesmo raciocínio já usado acima pra
    // Category/Team/ScheduleEntry (evita acoplar a um método novo em
    // ScoringTemplatesService).
    TypeOrmModule.forFeature([
      ScoreEvent,
      Category,
      Team,
      ScheduleEntry,
      ScoringTemplate,
      CategoryDayRelease,
    ]),
    EventsModule,
    JudgesModule,
    JudgingModule,
    ScheduleModule,
    ScoringTemplatesModule,
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
  providers: [ScoringService, ReleasesService],
})
export class ScoringModule {}

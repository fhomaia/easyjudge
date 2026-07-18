import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CriterionJudgeAssignment } from './entities/criterion-judge-assignment.entity';
import { SpecialRoleAssignment } from './entities/special-role-assignment.entity';
import { Category } from '../categories/entities/category.entity';
import { JudgingController } from './controllers/judging.controller';
import { JudgingService } from './services/judging.service';
import { EventsModule } from '../events/events.module';
import { JudgesModule } from '../judges/judges.module';
import { ScoringTemplatesModule } from '../scoring-templates/scoring-templates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CriterionJudgeAssignment,
      SpecialRoleAssignment,
      Category,
    ]),
    EventsModule,
    JudgesModule,
    ScoringTemplatesModule,
  ],
  controllers: [JudgingController],
  providers: [JudgingService],
})
export class JudgingModule {}

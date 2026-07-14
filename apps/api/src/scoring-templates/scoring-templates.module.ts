import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoringTemplate } from './entities/scoring-template.entity';
import { ScoringCriterion } from './entities/scoring-criterion.entity';
import { Category } from '../categories/entities/category.entity';
import { ScoringTemplatesController } from './controllers/scoring-templates.controller';
import { ScoringCriteriaController } from './controllers/scoring-criteria.controller';
import { ScoringTemplatesService } from './services/scoring-templates.service';
import { ScoringCriteriaService } from './services/scoring-criteria.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScoringTemplate, ScoringCriterion, Category]),
  ],
  controllers: [ScoringTemplatesController, ScoringCriteriaController],
  providers: [ScoringTemplatesService, ScoringCriteriaService],
  exports: [ScoringTemplatesService],
})
export class ScoringTemplatesModule {}

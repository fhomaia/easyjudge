import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoringTemplate } from './entities/scoring-template.entity';
import { ScoringCriterion } from './entities/scoring-criterion.entity';
import { Category } from '../categories/entities/category.entity';
import { Event } from '../events/entities/event.entity';
import { ScoringTemplatesController } from './controllers/scoring-templates.controller';
import { ScoringCriteriaController } from './controllers/scoring-criteria.controller';
import { ScoringTemplatesService } from './services/scoring-templates.service';
import { ScoringCriteriaService } from './services/scoring-criteria.service';

@Module({
  imports: [
    // Event aqui só pra ScoringTemplatesService checar o status do
    // evento que usa o template (assertNotLockedForEditing) — mesmo
    // raciocínio já usado pra Category: acesso ao repositório sem
    // importar EventsModule inteiro, evitando dependência circular
    // (EventsModule não importa ScoringTemplatesModule, mas
    // CategoriesModule importa os dois).
    TypeOrmModule.forFeature([
      ScoringTemplate,
      ScoringCriterion,
      Category,
      Event,
    ]),
  ],
  controllers: [ScoringTemplatesController, ScoringCriteriaController],
  providers: [ScoringTemplatesService, ScoringCriteriaService],
  exports: [ScoringTemplatesService, ScoringCriteriaService],
})
export class ScoringTemplatesModule {}

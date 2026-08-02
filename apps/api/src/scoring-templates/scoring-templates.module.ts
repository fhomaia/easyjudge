import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoringTemplate } from './entities/scoring-template.entity';
import { ScoringCriterion } from './entities/scoring-criterion.entity';
import { EventScoringTemplate } from './entities/event-scoring-template.entity';
import { Category } from '../categories/entities/category.entity';
import { Event } from '../events/entities/event.entity';
import { EventsModule } from '../events/events.module';
import { ScoringTemplatesController } from './controllers/scoring-templates.controller';
import { ScoringCriteriaController } from './controllers/scoring-criteria.controller';
import { EventScoringTemplatesController } from './controllers/event-scoring-templates.controller';
import { ScoringTemplatesService } from './services/scoring-templates.service';
import { ScoringCriteriaService } from './services/scoring-criteria.service';

@Module({
  imports: [
    // Event aqui (repositório direto, não o módulo) só pra
    // ScoringTemplatesService checar o status do evento que usa o
    // template (assertNotLockedForEditing) — mesmo raciocínio já usado
    // pra Category. EventsModule (2026-08-02, adicionado só pro
    // EventMemberGuard de EventScoringTemplatesController resolver
    // EventsService) é seguro de importar de verdade: EventsModule não
    // importa ScoringTemplatesModule de volta, sem ciclo (mesmo padrão
    // já usado por CategoriesModule/ScheduleModule).
    TypeOrmModule.forFeature([
      ScoringTemplate,
      ScoringCriterion,
      EventScoringTemplate,
      Category,
      Event,
    ]),
    EventsModule,
  ],
  controllers: [
    ScoringTemplatesController,
    ScoringCriteriaController,
    EventScoringTemplatesController,
  ],
  providers: [ScoringTemplatesService, ScoringCriteriaService],
  exports: [ScoringTemplatesService, ScoringCriteriaService],
})
export class ScoringTemplatesModule {}

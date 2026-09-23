import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../categories/entities/category.entity';
import { Team } from '../teams/entities/team.entity';
import { ScheduleEntry } from '../schedule/entities/schedule-entry.entity';
import { EventMetricsController } from './controllers/event-metrics.controller';
import { EventMetricsService } from './services/event-metrics.service';
import { EventsModule } from '../events/events.module';
import { ProgramsModule } from '../programs/programs.module';

@Module({
  imports: [
    // Category/Team/ScheduleEntry aqui só pro repositório (contagem/
    // agrupamento) — mesmo padrão já usado em events.module.ts/
    // scoring.module.ts pra evitar importar CategoriesModule/TeamsModule/
    // ScheduleModule inteiros só por isso. Programas reaproveitam
    // ProgramsService.findAllForEvent (já resolve ProgramProfile/
    // teamsCount) em vez de duplicar essa lógica com um repositório
    // próprio de ProgramParticipation.
    TypeOrmModule.forFeature([Category, Team, ScheduleEntry]),
    EventsModule,
    ProgramsModule,
  ],
  controllers: [EventMetricsController],
  providers: [EventMetricsService],
})
export class EventMetricsModule {}

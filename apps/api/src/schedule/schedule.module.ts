import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleDay } from './entities/schedule-day.entity';
import { ScheduleResource } from './entities/schedule-resource.entity';
import { ScheduleEntry } from './entities/schedule-entry.entity';
import { Team } from '../teams/entities/team.entity';
import { Category } from '../categories/entities/category.entity';
import { ScheduleController } from './controllers/schedule.controller';
import { ScheduleService } from './services/schedule.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScheduleDay,
      ScheduleResource,
      ScheduleEntry,
      Team,
      Category,
    ]),
    EventsModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}

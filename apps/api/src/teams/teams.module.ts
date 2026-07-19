import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from './entities/team.entity';
import { Category } from '../categories/entities/category.entity';
import { TeamsController } from './controllers/teams.controller';
import { EventTeamsController } from './controllers/event-teams.controller';
import { TeamsService } from './services/teams.service';
import { ProgramsModule } from '../programs/programs.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, Category]),
    ProgramsModule,
    EventsModule,
  ],
  controllers: [TeamsController, EventTeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}

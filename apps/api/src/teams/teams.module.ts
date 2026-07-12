import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from './entities/team.entity';
import { TeamsController } from './controllers/teams.controller';
import { TeamsService } from './services/teams.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([Team]), EventsModule],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}

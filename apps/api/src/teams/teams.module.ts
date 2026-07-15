import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from './entities/team.entity';
import { Category } from '../categories/entities/category.entity';
import { TeamsController } from './controllers/teams.controller';
import { TeamsService } from './services/teams.service';
import { ProgramsModule } from '../programs/programs.module';

@Module({
  imports: [TypeOrmModule.forFeature([Team, Category]), ProgramsModule],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}

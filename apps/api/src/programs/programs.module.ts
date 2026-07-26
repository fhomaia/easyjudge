import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgramParticipation } from './entities/program-participation.entity';
import { ProgramProfile } from './entities/program-profile.entity';
import { ProgramsController } from './controllers/programs.controller';
import { ProgramProfileController } from './controllers/program-profile.controller';
import { ProgramCatalogController } from './controllers/program-catalog.controller';
import { ProgramsService } from './services/programs.service';
import { EventsModule } from '../events/events.module';
import { UsersModule } from '../users/users.module';
import { AthletesModule } from '../athletes/athletes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProgramParticipation, ProgramProfile]),
    EventsModule,
    UsersModule,
    AthletesModule,
  ],
  controllers: [
    ProgramsController,
    ProgramProfileController,
    ProgramCatalogController,
  ],
  providers: [ProgramsService],
  exports: [ProgramsService],
})
export class ProgramsModule {}

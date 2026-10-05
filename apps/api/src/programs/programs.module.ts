import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgramParticipation } from './entities/program-participation.entity';
import { ProgramProfile } from './entities/program-profile.entity';
import { ProgramAthlete } from './entities/program-athlete.entity';
import { TeamCategoryAthlete } from './entities/team-category-athlete.entity';
import { Team } from '../teams/entities/team.entity';
import { Category } from '../categories/entities/category.entity';
import { ProgramRegistrationController } from './controllers/program-registration.controller';
import { ProgramRegistrationAdminController } from './controllers/program-registration-admin.controller';
import { RegistrationRequest } from './entities/registration-request.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../auth/mail.module';
import { ProgramRegistrationService } from './services/program-registration.service';
import { ProgramAthletesController } from './controllers/program-athletes.controller';
import { ProgramAthletesService } from './services/program-athletes.service';
import { ProgramsController } from './controllers/programs.controller';
import { ProgramProfileController } from './controllers/program-profile.controller';
import { ProgramCatalogController } from './controllers/program-catalog.controller';
import { ProgramsService } from './services/programs.service';
import { EventsModule } from '../events/events.module';
import { UsersModule } from '../users/users.module';
import { AthletesModule } from '../athletes/athletes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProgramParticipation,
      ProgramProfile,
      ProgramAthlete,
      TeamCategoryAthlete,
      Team,
      Category,
      RegistrationRequest,
    ]),
    NotificationsModule,
    MailModule,
    EventsModule,
    UsersModule,
    AthletesModule,
  ],
  controllers: [
    ProgramsController,
    ProgramProfileController,
    ProgramCatalogController,
    ProgramAthletesController,
    ProgramRegistrationController,
    ProgramRegistrationAdminController,
  ],
  providers: [
    ProgramsService,
    ProgramAthletesService,
    ProgramRegistrationService,
  ],
  exports: [ProgramsService, ProgramAthletesService],
})
export class ProgramsModule {}

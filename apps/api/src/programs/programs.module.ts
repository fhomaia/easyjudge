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
import { RegistrationSettings } from './entities/registration-settings.entity';
import { AthleteRequirementValue } from './entities/athlete-requirement-value.entity';
import { AthleteLink } from '../athletes/entities/athlete-link.entity';
import { AthleteRequirementDocument } from '../documents/entities/athlete-requirement-document.entity';
import { DocumentsModule } from '../documents/documents.module';
import { AthleteRegistrationController } from './controllers/athlete-registration.controller';
import { AthleteRegistrationService } from './services/athlete-registration.service';
import { ProgramAthleteRequirementsService } from './services/program-athlete-requirements.service';
import { RegistrationSettingsController } from './controllers/registration-settings.controller';
import { RegistrationSettingsService } from './services/registration-settings.service';
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
import { CategoriesModule } from '../categories/categories.module';
import { RegulationsModule } from '../regulations/regulations.module';

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
      RegistrationSettings,
      AthleteRequirementValue,
      AthleteLink,
      AthleteRequirementDocument,
    ]),
    DocumentsModule,
    NotificationsModule,
    MailModule,
    EventsModule,
    UsersModule,
    AthletesModule,
    CategoriesModule,
    RegulationsModule,
  ],
  controllers: [
    ProgramsController,
    ProgramProfileController,
    ProgramCatalogController,
    ProgramAthletesController,
    ProgramRegistrationController,
    ProgramRegistrationAdminController,
    RegistrationSettingsController,
    AthleteRegistrationController,
  ],
  providers: [
    ProgramsService,
    ProgramAthletesService,
    ProgramRegistrationService,
    RegistrationSettingsService,
    ProgramAthleteRequirementsService,
    AthleteRegistrationService,
  ],
  exports: [ProgramsService, ProgramAthletesService],
})
export class ProgramsModule {}

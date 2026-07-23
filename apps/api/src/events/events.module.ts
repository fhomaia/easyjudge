import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { EventMember } from './entities/event-member.entity';
import { EventActivityLog } from './entities/event-activity-log.entity';
import { Category } from '../categories/entities/category.entity';
import { ProgramParticipation } from '../programs/entities/program-participation.entity';
import { EventsController } from './controllers/events.controller';
import { EventStaffController } from './controllers/event-staff.controller';
import { EventsService } from './services/events.service';
import { EventStaffService } from './services/event-staff.service';
import { EventActivityLogService } from './services/event-activity-log.service';
import { EventMemberGuard } from './guards/event-member.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    // Category/ProgramParticipation aqui só pra EventsService ter
    // acesso aos repositórios (contagem/listagem por aliasId em
    // findAllForUser/findOneForUser, exclusão em deleteEvent) — não
    // importa CategoriesModule/ProgramsModule inteiros, evitando
    // dependência circular (mesmo padrão já usado por
    // ScoringTemplatesModule para Category).
    TypeOrmModule.forFeature([
      Event,
      EventMember,
      EventActivityLog,
      Category,
      ProgramParticipation,
    ]),
    UsersModule,
  ],
  controllers: [EventsController, EventStaffController],
  providers: [
    EventsService,
    EventStaffService,
    EventActivityLogService,
    EventMemberGuard,
  ],
  exports: [EventsService, EventMemberGuard],
})
export class EventsModule {}

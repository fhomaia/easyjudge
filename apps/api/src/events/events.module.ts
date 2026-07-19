import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { EventMember } from './entities/event-member.entity';
import { EventsController } from './controllers/events.controller';
import { EventStaffController } from './controllers/event-staff.controller';
import { EventsService } from './services/events.service';
import { EventStaffService } from './services/event-staff.service';
import { EventMemberGuard } from './guards/event-member.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Event, EventMember]), UsersModule],
  controllers: [EventsController, EventStaffController],
  providers: [EventsService, EventStaffService, EventMemberGuard],
  exports: [EventsService, EventMemberGuard],
})
export class EventsModule {}

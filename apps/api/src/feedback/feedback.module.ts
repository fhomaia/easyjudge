import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventFeedback } from './entities/event-feedback.entity';
import { PlatformFeedback } from './entities/platform-feedback.entity';
import { EventFeedbackService } from './services/event-feedback.service';
import { PlatformFeedbackService } from './services/platform-feedback.service';
import { EventFeedbackController } from './controllers/event-feedback.controller';
import { PlatformFeedbackController } from './controllers/platform-feedback.controller';
import { EventMember } from '../events/entities/event-member.entity';
import { User } from '../users/entities/user.entity';
import { EventsModule } from '../events/events.module';

// Avaliações do evento e da plataforma (2026-09-24). Tabelas próprias,
// sem tocar em nenhuma regra existente.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventFeedback,
      PlatformFeedback,
      EventMember,
      User,
    ]),
    EventsModule,
  ],
  controllers: [EventFeedbackController, PlatformFeedbackController],
  providers: [EventFeedbackService, PlatformFeedbackService],
})
export class FeedbackModule {}

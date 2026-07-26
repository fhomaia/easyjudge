import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { Event } from '../events/entities/event.entity';
import { EventMember } from '../events/entities/event-member.entity';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsService } from './services/notifications.service';

// Event/EventMember aqui só pra NotificationsService ter acesso aos
// repositórios (resolver aliasId a partir de :eventId, checar
// membership/papel) — não importa EventsModule inteiro, evitando
// dependência circular: EventsModule (e ScheduleModule/ScoringModule)
// importam ESTE módulo pra disparar notificação nos pontos de gatilho,
// então o sentido inverso não pode existir (mesmo padrão já usado por
// ScoringTemplatesModule/AthletesModule).
@Module({
  imports: [TypeOrmModule.forFeature([Notification, Event, EventMember])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

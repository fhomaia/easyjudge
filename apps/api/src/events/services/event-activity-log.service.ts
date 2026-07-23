import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventActivityLog } from '../entities/event-activity-log.entity';
import { EventActivityAction } from '../enums/event-activity-action.enum';

// Escrita do log de atividade do evento — sem leitura ainda (nenhuma
// tela consome isso hoje), só o registro pra existir o histórico desde
// já. Chamado por EventsService a cada ação de ciclo de vida relevante.
@Injectable()
export class EventActivityLogService {
  constructor(
    @InjectRepository(EventActivityLog)
    private readonly logsRepo: Repository<EventActivityLog>,
  ) {}

  async record(
    eventAliasId: string,
    actorId: string,
    action: EventActivityAction,
  ): Promise<void> {
    await this.logsRepo.save(
      this.logsRepo.create({ eventAliasId, actorId, action }),
    );
  }
}

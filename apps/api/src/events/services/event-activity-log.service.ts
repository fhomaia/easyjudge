import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventActivityLog } from '../entities/event-activity-log.entity';
import { EventActivityAction } from '../enums/event-activity-action.enum';

// Escrita e leitura do log de atividade do evento — a leitura
// (findForEvent) entrou em 2026-07-26 pra alimentar a tela "Histórico"
// (ver EventHistoryPage no frontend, EventsController/EventsService.
// getActivityLog); antes disso só existia o registro. Chamado por
// EventsService (ciclo de vida do evento) e, desde 2026-07-26, também
// por CategoriesService/ProgramsService/TeamsService/RegulationsService/
// EventStaffService (ações nas telas de cadastro) — exportado de
// EventsModule pra esses módulos poderem injetar (todos já importam
// EventsModule por outro motivo, então não precisou de import novo).
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
    detail?: string,
  ): Promise<void> {
    await this.logsRepo.save(
      this.logsRepo.create({
        eventAliasId,
        actorId,
        action,
        detail: detail ?? null,
      }),
    );
  }

  // Todo o histórico do aliasId, através de qualquer versão do evento
  // (o log é endereçado por aliasId, não por uma versão específica) —
  // mais recente primeiro. `actor` vem hidratado pra exibir o nome de
  // quem fez a ação sem uma segunda consulta por linha.
  async findForEvent(eventAliasId: string): Promise<EventActivityLog[]> {
    return this.logsRepo.find({
      where: { eventAliasId },
      relations: ['actor'],
      order: { createdAt: 'DESC' },
    });
  }
}

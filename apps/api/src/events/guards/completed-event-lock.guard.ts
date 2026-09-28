import {
  CanActivate,
  ConflictException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { Event } from '../entities/event.entity';
import { EventStatus } from '../enums/event-status.enum';

// Evento concluído é só para consulta (2026-09-28): guard global
// (APP_GUARD, ver EventsModule) que recusa qualquer escrita em rota de
// evento (`/events/:id` ou `/events/:eventId/...`) quando o evento já
// foi concluído, em vez de cada service lembrar de checar. Leitura
// continua livre. As travas locais que já existiam (mover, desistência,
// nota) continuam valendo como segunda camada.
//
// Exceções: o que não altera o evento em si.
const ALLOWED_WHEN_COMPLETED = new Set([
  'PUT /events/:eventId/feedback/me', // avaliação do evento
  'POST /events/:eventId/notifications/seen', // marcar notificações como vistas
  'DELETE /events/:id', // excluir o evento continua possível pro dono
]);

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CompletedEventLockGuard implements CanActivate {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (READ_METHODS.has(req.method)) return true;

    const routePath = (req.route as { path?: string } | undefined)?.path;
    if (!routePath?.startsWith('/events/:')) return true;
    if (ALLOWED_WHEN_COMPLETED.has(`${req.method} ${routePath}`)) return true;

    const aliasId = req.params.eventId ?? req.params.id;
    // Id malformado ou evento inexistente: deixa a rota responder (404/400).
    if (typeof aliasId !== 'string' || !isUUID(aliasId)) return true;
    const event = await this.eventsRepo.findOne({
      where: { aliasId, active: true },
      select: ['id', 'status'],
    });
    if (event?.status === EventStatus.COMPLETED) {
      throw new ConflictException('O evento já foi concluído.');
    }
    return true;
  }
}

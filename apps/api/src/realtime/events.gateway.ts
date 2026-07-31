import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EventMember } from '../events/entities/event-member.entity';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

interface NotificationCreatedPayload {
  aliasId: string;
  id: string;
  type: string;
  audience: string;
  title: string;
  scheduleEntryId: string | null;
}

interface EventStatusChangedPayload {
  aliasId: string;
  status: string;
}

function eventRoom(aliasId: string): string {
  return `event:${aliasId}`;
}

// Camada de "avisar quem está olhando que algo mudou" pro painel
// "evento ao vivo" — NUNCA o caminho de escrita de nota (ScoreEvent
// continua sendo só POST HTTP + buffer IndexedDB, requisito
// não-negociável do projeto). Só sinal + aliasId, sem payload de
// domínio completo — quem recebe o sinal refaz o mesmo GET que o
// polling antigo já fazia (ver CLAUDE.md, "Tempo real").
//
// Autenticação própria aqui (não dá pra reaproveitar `JwtAuthGuard`,
// que é `CanActivate` amarrado a `ExecutionContext.switchToHttp()`/
// Passport) — lê o token do handshake e valida manualmente com o
// mesmo `JWT_SECRET` de `jwt.strategy.ts`. `EventMember` é injetado
// direto (mesmo padrão de `NotificationsModule`, evita importar
// `EventsModule` inteiro e criar ciclo com este módulo).
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(EventMember)
    private readonly membersRepo: Repository<EventMember>,
  ) {}

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
      client.data.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { aliasId?: string },
  ) {
    const userId = client.data.userId as string | undefined;
    const aliasId = body?.aliasId;
    if (!userId || !aliasId) return;

    // Mesma checagem de acesso de `EventMemberGuard` (membership por
    // `aliasId`), reimplementada aqui em vez de importar
    // `EventsService`/`EventsModule` — evitaria import circular
    // (`RealtimeModule` precisaria de `EventsModule` pra isso, e
    // `EventsModule` já precisa de `RealtimeModule` pra emitir status).
    const member = await this.membersRepo.findOneBy({ aliasId, userId });
    if (!member) return;

    client.join(eventRoom(aliasId));
  }

  @SubscribeMessage('leave')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { aliasId?: string },
  ) {
    if (!body?.aliasId) return;
    client.leave(eventRoom(body.aliasId));
  }

  @OnEvent('notification.created')
  handleNotificationCreated(payload: NotificationCreatedPayload) {
    this.server.to(eventRoom(payload.aliasId)).emit('notification.created', payload);
  }

  @OnEvent('event.status_changed')
  handleEventStatusChanged(payload: EventStatusChangedPayload) {
    this.server.to(eventRoom(payload.aliasId)).emit('event.status_changed', payload);
  }
}

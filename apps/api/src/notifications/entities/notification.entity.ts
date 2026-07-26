import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationAudience } from '../enums/notification-audience.enum';

// Log append-only (nunca é editado depois de criado, mesmo espírito de
// ScoreEvent) — uma linha por notificação disparada. `title` já vem
// formatado na criação (não é resolvido depois a partir de
// scheduleEntryId/teamId): é um registro histórico, então continua
// legível mesmo se a equipe for renomeada depois.
//
// Vinculada pelo `aliasId` do evento (estável entre versões), não pelo
// `id` de uma versão específica — mesmo padrão de EventMember.aliasId —
// sem FK, disciplina de aplicação (ver NotificationsService).
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'enum', enum: NotificationAudience })
  audience: NotificationAudience;

  @Column({ type: 'varchar' })
  title: string;

  // Presente nas notificações ligadas a uma apresentação específica
  // (concluída/avaliação pendente/contestação solicitada); nulo nas de
  // evento inteiro (súmulas/resultado/contestação liberados). Sem FK
  // (mesmo padrão de ScheduleEntry.linkedEntryId em breaks livres) —
  // não trava a apresentação/entry contra exclusão.
  @Column({ name: 'schedule_entry_id', type: 'uuid', nullable: true })
  scheduleEntryId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

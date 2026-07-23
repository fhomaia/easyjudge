import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { EventActivityAction } from '../enums/event-activity-action.enum';

// Log de ações administrativas do evento (quem fez, o quê, quando, em
// qual evento) — append-only, nunca é editado/apagado por nenhum
// método de EventsService (mesmo raciocínio de "nunca perder um
// registro" já aplicado às notas, ver CLAUDE.md). Gravado por
// EventActivityLogService, chamado a partir de EventsService.
@Entity('event_activity_logs')
export class EventActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Endereçado pelo aliasId (identidade lógica do evento através das
  // versões), não pelo `id` de uma versão específica — mesmo padrão de
  // EventMember/Category/etc. Sem FK de propósito: `alias_id` nunca
  // corresponde a uma linha própria em `events`, é só um identificador
  // estável compartilhado entre as versões (ver
  // AddAliasIdToEventScopedChildEntities).
  @Index()
  @Column({ name: 'event_alias_id', type: 'uuid' })
  eventAliasId: string;

  @Column({ type: 'enum', enum: EventActivityAction })
  action: EventActivityAction;

  @Index()
  @Column({ name: 'actor_id' })
  actorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'actor_id' })
  actor: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

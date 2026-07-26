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
// EventActivityLogService, chamado a partir de EventsService e (desde
// 2026-07-26) também de CategoriesService/ProgramsService/TeamsService/
// RegulationsService/EventStaffService — cobre tanto o ciclo de vida
// do evento em si quanto as ações nas telas de cadastro.
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

  // Nome/identificação da entidade afetada (nome da categoria, do
  // programa, da equipe, do documento, do membro do staff...) — deixa
  // a mensagem de histórico específica sem precisar de um valor de
  // enum por combinação ação+entidade. Nulo nas ações de ciclo de vida
  // do próprio evento (created/updated/published/...), que já são
  // autoexplicativas sem detalhe extra.
  @Column({ type: 'varchar', nullable: true })
  detail: string | null;

  @Index()
  @Column({ name: 'actor_id' })
  actorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'actor_id' })
  actor: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

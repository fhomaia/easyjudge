import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { EventStatus } from '../enums/event-status.enum';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'competition_days' })
  competitionDays: number;

  @Column({ length: 150 })
  location: string;

  // Nome do local físico (ex. "Expominas"), separado de `location`
  // (cidade/UF). Opcional — nem todo evento informa.
  @Column({ type: 'varchar', nullable: true })
  venue: string | null;

  @Column({ name: 'logo_url', type: 'varchar', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.CREATED })
  status: EventStatus;

  // Preenchido por EventsService.startEvent quando o evento vira
  // "started" — não faz parte do publishEvent (reseta a cada nova
  // versão publicada, já que uma versão nova ainda não foi iniciada).
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  // Identidade lógica do evento através das versões — o `id` é
  // específico de cada linha/versão, o `aliasId` é o mesmo em todas as
  // versões de um mesmo evento (é através dele que EventMember vincula
  // usuários ao evento, não pelo `id`). Ver EventsService.publishEvent.
  @Index()
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  // Só uma linha por aliasId pode estar active=true por vez (garantido
  // por índice único parcial na migration). Ao publicar uma nova
  // versão, a linha antiga é marcada active=false (mas continua no
  // banco pra histórico/auditoria) e uma linha nova é inserida.
  @Column({ default: true })
  active: boolean;

  @Index()
  @Column({ name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  // Não são colunas — populadas por EventsService (findAllForUser via
  // subquery de COUNT; findOneForUser buscando Category/
  // ProgramParticipation direto pelo aliasId), só para telas de
  // listagem/configuração do evento. Category/ProgramParticipation não
  // têm mais relação TypeORM com Event (endereçadas por aliasId, sem
  // FK) — ver migration AddAliasIdToEventScopedChildEntities.
  categoriesCount?: number;
  programsCount?: number;
  categoriesUpdatedAt?: Date | null;
  programsUpdatedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

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
import { ScheduleResource } from './schedule-resource.entity';
import { Team } from '../../teams/entities/team.entity';
import { Category } from '../../categories/entities/category.entity';
import { ScheduleEntryType } from '../enums/schedule-entry-type.enum';

// O card da timeline. Sem `scheduleDayId` redundante (deriva via
// `resource.scheduleDayId`, mesmo raciocínio de Team não denormalizar
// `eventId`). `order` é a fonte de verdade da sequência dentro do
// `resourceId` — sem constraint única no banco (mesmo padrão de
// ScoringCriterion.order), a disciplina de renumeração sequencial é só
// da aplicação (ver ScheduleService). Horário (start/end) NUNCA é
// persistido — sempre computado no cliente a partir de `order` +
// `durationMinutes` (ver apps/web/src/lib/scheduleTime.ts).
@Entity('schedule_entries')
export class ScheduleEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'resource_id' })
  resourceId: string;

  @ManyToOne(() => ScheduleResource, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resource_id' })
  resource: ScheduleResource;

  @Column({ type: 'enum', enum: ScheduleEntryType })
  type: ScheduleEntryType;

  @Column({ type: 'int' })
  order: number;

  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes: number;

  // Só presentation/warmup.
  @Index()
  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  // Só presentation — warmup herda a categoria via linkedEntryId, não
  // duplica.
  @Index()
  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  // Em warmup, aponta pra sua presentation correspondente. Nos breaks
  // "Aguardando aquecimento"/"Aguardando disponibilidade da equipe"
  // (só esses, não em breaks livres como Almoço), também aponta pra
  // essa mesma presentation — é o que permite ao removeEntry limpar o
  // grupo inteiro (presentation + warmup + intervalos de espera) de
  // uma vez, evitando buracos órfãos na timeline.
  @Column({ name: 'linked_entry_id', type: 'uuid', nullable: true })
  linkedEntryId: string | null;

  @ManyToOne(() => ScheduleEntry, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'linked_entry_id' })
  linkedEntry: ScheduleEntry | null;

  // Texto customizado de break/ceremony/award (ex: "Almoço").
  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Category } from '../../categories/entities/category.entity';
import { Team } from '../../teams/entities/team.entity';
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

  @Column({ name: 'logo_url', type: 'varchar', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.CREATED })
  status: EventStatus;

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

  @OneToMany(() => Category, (category) => category.event)
  categories: Category[];

  @OneToMany(() => Team, (team) => team.event)
  teams: Team[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

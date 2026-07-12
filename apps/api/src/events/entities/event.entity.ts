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

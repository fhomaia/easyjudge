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
import { Event } from '../../events/entities/event.entity';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'event_id' })
  eventId: string;

  @ManyToOne(() => Event, (event) => event.teams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ length: 150 })
  name: string;

  @Column()
  email: string;

  @Column({ length: 100 })
  city: string;

  @Column({ length: 2 })
  state: string;

  @Column({ name: 'logo_url', type: 'varchar', nullable: true })
  logoUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

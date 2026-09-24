import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Avaliação de um EVENTO por quem participou dele (nota de 1 a 5 e
// comentário opcional). Uma por pessoa por evento, editável. Separada
// da avaliação da plataforma (PlatformFeedback) de propósito: um atraso
// no evento não deve pesar na nota da Cheer Cup, nem o contrário. O
// produtor (admin/assessor do evento) vê quem avaliou.
@Entity('event_feedbacks')
@Unique(['aliasId', 'userId'])
export class EventFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

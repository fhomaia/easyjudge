import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Avaliação da PLATAFORMA (Cheer Cup), feita a qualquer momento pelo
// menu. Cada envio é uma linha (a pessoa pode avaliar de novo depois).
// Só o dono da plataforma lista (ver PlatformFeedbackService).
@Entity('platform_feedbacks')
export class PlatformFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  // Tipo da conta no momento do envio e tela de onde veio — ajudam a
  // entender um problema relatado.
  @Column({ name: 'user_role', type: 'varchar' })
  userRole: string;

  @Column({ type: 'varchar', nullable: true })
  page: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

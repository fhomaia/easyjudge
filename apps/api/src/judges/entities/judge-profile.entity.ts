import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Perfil canônico do jurado, 1:1 com o usuário (role JUDGE) — mesma
// ideia de ProgramProfile: fonte única de verdade pra nome/email de
// contato uma vez que o jurado tem conta própria na plataforma. As
// `JudgeParticipation` de cada evento deixam de guardar cópia própria
// desses dados assim que ficam vinculadas a um userId — a leitura
// passa a vir daqui via join (JudgesService.toJudgeView).
@Entity('judge_profiles')
export class JudgeProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'user_id' })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 150 })
  name: string;

  @Column({ name: 'contact_email' })
  contactEmail: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

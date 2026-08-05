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

// Uma linha é criada a CADA solicitação de "esqueci minha senha", mesmo
// quando o email não corresponde a nenhum usuário (userId fica null nesse
// caso) — o response de POST /auth/forgot-password é idêntico nos dois
// casos, então o formato da tabela também precisa admitir os dois sem
// distinção visível pelo cliente (ver AuthService.forgotPassword).
@Entity('password_resets')
export class PasswordReset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar', length: 6, nullable: true })
  code: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  // Setado quando o código é confirmado — precisa disso pra chegar na
  // etapa de definir a nova senha, sem precisar reenviar o código ali.
  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  // Setado só quando a senha É de fato trocada (etapa final) — separado
  // de verifiedAt pra não invalidar a sessão de reset entre confirmar o
  // código e enviar a nova senha.
  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

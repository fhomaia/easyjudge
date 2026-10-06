import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Biblioteca de documentos da conta do atleta (2026-10-06): tudo o que ele
// enviou fica aqui pra reaproveitar em outros eventos. Excluir daqui NÃO
// tira o documento dos eventos onde já foi enviado (o evento guarda a
// própria referência ao arquivo).
@Entity('user_documents')
export class UserDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'file_key', type: 'varchar', length: 200 })
  fileKey: string;

  // Pra que foi enviado (ex.: "Documento de identidade"); só exibição.
  @Column({ type: 'varchar', length: 120, nullable: true })
  label: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

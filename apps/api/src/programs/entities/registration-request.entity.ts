import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProgramParticipation } from './program-participation.entity';

export enum RegistrationRequestType {
  CHANGE = 'change',
  CANCEL = 'cancel',
}

// Pedido do programa ao organizador depois de enviar a ficha de
// inscrição (que fica travada): alteração ou cancelamento (2026-10-05).
// Notifica admin/assessor (plataforma + email); o organizador marca como
// resolvido.
@Entity('registration_requests')
export class RegistrationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  @Index()
  @Column({ name: 'program_id', type: 'uuid' })
  programId: string;

  @ManyToOne(() => ProgramParticipation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_id' })
  program: ProgramParticipation;

  @Column({ type: 'enum', enum: RegistrationRequestType })
  type: RegistrationRequestType;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by_id', type: 'uuid', nullable: true })
  resolvedById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

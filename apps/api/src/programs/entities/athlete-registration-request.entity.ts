import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProgramParticipation } from './program-participation.entity';
import { ProgramAthlete } from './program-athlete.entity';
import { User } from '../../users/entities/user.entity';

export enum AthleteRequestStatus {
  // O atleta ainda está montando (escolheu programa/categorias, não enviou).
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  CHANGES_REQUESTED = 'changes_requested',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  // Aprovado e depois o atleta pediu correção (2026-10-10): volta pra
  // Aprovação; o programa aprova com as mudanças ou mantém como estava.
  CORRECTION_REQUESTED = 'correction_requested',
}

// Pedidos que ainda podem mudar (no máximo um por atleta+programa+evento,
// índice parcial da migration). Recusado libera um pedido novo.
export const OPEN_REQUEST_STATUSES = [
  AthleteRequestStatus.DRAFT,
  AthleteRequestStatus.SUBMITTED,
  AthleteRequestStatus.CHANGES_REQUESTED,
];

// Pedido de inscrição do ATLETA num programa, num evento (2026-10-10).
// Etapas: Cadastro (o atleta preenche dados/documentos e escolhe as
// categorias) -> Aprovação (o programa aprova escolhendo a equipe de cada
// categoria, pede correção ou recusa) -> Pagamento (fase 3). Os dados e
// documentos ficam no atleta do evento (ProgramAthlete), como na inscrição
// feita pelo programa; aqui só o pedido em si. Aprovar escala o atleta em
// TeamCategoryAthlete e confirma o vínculo (AthleteLink).
@Entity('athlete_registration_requests')
export class AthleteRegistrationRequest {
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

  @Column({ name: 'program_athlete_id', type: 'uuid' })
  programAthleteId: string;

  @ManyToOne(() => ProgramAthlete, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_athlete_id' })
  programAthlete: ProgramAthlete;

  @Index()
  @Column({ name: 'athlete_user_id', type: 'uuid' })
  athleteUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'athlete_user_id' })
  athleteUser: User;

  @Column({
    type: 'varchar',
    length: 20,
    default: AthleteRequestStatus.DRAFT,
  })
  status: AthleteRequestStatus;

  // Categorias que o atleta pediu (ou que o programa deixou na aprovação).
  @Column({ name: 'category_ids', type: 'jsonb', default: () => "'[]'" })
  categoryIds: string[];

  // Recado do atleta pro programa (ex.: "quero ficar com a turma do Bravo").
  @Column({ type: 'text', nullable: true })
  note: string | null;

  // Motivo da correção pedida ou da recusa.
  @Column({ name: 'response_message', type: 'text', nullable: true })
  responseMessage: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'responded_by', type: 'uuid', nullable: true })
  respondedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

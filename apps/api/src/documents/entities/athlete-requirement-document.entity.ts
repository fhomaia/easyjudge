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
import { ProgramAthlete } from '../../programs/entities/program-athlete.entity';

export type AthleteDocumentStatus = 'sent' | 'contested';

// Documento enviado pra um item pedido na inscrição (RegistrationRequirement
// de tipo documento), por atleta do evento. Um ou mais arquivos (frente e
// verso). Reenviar troca os arquivos e tira a contestação. Sai junto com o
// atleta do evento (FK CASCADE) e 30 dias depois de o evento ser concluído
// (DocumentsCleanupService, LGPD).
@Entity('athlete_requirement_documents')
@Index(['programAthleteId', 'requirementId'], { unique: true })
export class AthleteRequirementDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  @Column({ name: 'program_athlete_id', type: 'uuid' })
  programAthleteId: string;

  @ManyToOne(() => ProgramAthlete, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_athlete_id' })
  programAthlete: ProgramAthlete;

  @Column({ name: 'requirement_id', type: 'varchar', length: 60 })
  requirementId: string;

  // Chaves de PrivateFile, na ordem enviada.
  @Column({ name: 'file_keys', type: 'jsonb', default: () => "'[]'" })
  fileKeys: string[];

  @Column({ type: 'varchar', length: 20, default: 'sent' })
  status: AthleteDocumentStatus;

  @Column({ name: 'contest_reason', type: 'text', nullable: true })
  contestReason: string | null;

  @Column({ name: 'contested_at', type: 'timestamptz', nullable: true })
  contestedAt: Date | null;

  @Column({ name: 'contested_by', type: 'uuid', nullable: true })
  contestedBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

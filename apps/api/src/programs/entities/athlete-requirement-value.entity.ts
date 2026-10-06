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
import { ProgramAthlete } from './program-athlete.entity';

// Resposta de um atleta do evento a um dado pedido na inscrição
// (RegistrationRequirement de texto, lista ou data; documentos vêm
// depois). Data de nascimento e CPF NÃO ficam aqui: usam o valor único do
// atleta (conta, elenco ou atleta do evento). Sai junto com o atleta do
// evento (FK CASCADE).
@Entity('athlete_requirement_values')
@Index(['programAthleteId', 'requirementId'], { unique: true })
export class AthleteRequirementValue {
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

  // Id da exigência (RegistrationRequirement.id, ex.: req_ab12cd34).
  @Column({ name: 'requirement_id', type: 'varchar', length: 60 })
  requirementId: string;

  @Column({ type: 'text' })
  value: string;

  // Quem preencheu por último (atleta, programa ou produtor).
  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

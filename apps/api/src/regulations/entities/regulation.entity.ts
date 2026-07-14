import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Event } from '../../events/entities/event.entity';
import { RegulationDocument } from './regulation-document.entity';
import { RegulationDeductionMode } from '../enums/regulation-deduction-mode.enum';
import { DeductionType } from '../enums/deduction-type.enum';

// Config de regulamento de um evento (documentos + deduções) — 1:1 com
// Event, endereçada sempre por eventId (nunca pelo próprio id, ver
// RegulationsService). Não existe até o primeiro PATCH/upload — GET
// devolve uma view sintética antes disso.
@Entity('regulations')
export class Regulation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'event_id' })
  eventId: string;

  @OneToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({
    name: 'deduction_mode',
    type: 'enum',
    enum: RegulationDeductionMode,
    default: RegulationDeductionMode.IASF,
  })
  deductionMode: RegulationDeductionMode;

  // Só guarda os overrides quando deductionMode = 'custom' — chaves
  // ausentes caem pro valor padrão IASF (ver iasf-deductions.ts).
  @Column({ name: 'deduction_values', type: 'jsonb', nullable: true })
  deductionValues: Partial<Record<DeductionType, number>> | null;

  @OneToMany(() => RegulationDocument, (document) => document.regulation)
  documents: RegulationDocument[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

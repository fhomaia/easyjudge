import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { RegulationDocument } from './regulation-document.entity';
import { RegulationDeductionMode } from '../enums/regulation-deduction-mode.enum';
import { DeductionType } from '../enums/deduction-type.enum';

export interface CustomDeduction {
  id: string;
  label: string;
  value: number;
}

// Config de regulamento de um evento (documentos + deduções) — 1:1 com
// Event, endereçada sempre por eventId (nunca pelo próprio id, ver
// RegulationsService). Não existe até o primeiro PATCH/upload — GET
// devolve uma view sintética antes disso.
@Entity('regulations')
export class Regulation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Identifica o evento pelo aliasId (estável entre versões), não pelo
  // id de uma versão específica — sem FK, mesmo padrão de
  // EventMember.aliasId. Único (1:1 com o evento, agora "por aliasId"
  // em vez de "por versão"). Ver migration
  // AddAliasIdToEventScopedChildEntities.
  @Index({ unique: true })
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

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

  // Tipos de dedução criados pelo organizador (só valem no modo
  // 'custom'). `id` é a chave usada nas notas (custom_<uuid>), estável
  // mesmo renomeando; `value` fica sempre <= 0 (subtrai do total).
  @Column({ name: 'custom_deductions', type: 'jsonb', nullable: true })
  customDeductions: CustomDeduction[] | null;

  // Tipos PADRÃO removidos no modo 'custom' (valores de DeductionType).
  // Só oculta neste evento; ver RegulationsService.updateDeductions.
  @Column({ name: 'hidden_deductions', type: 'jsonb', nullable: true })
  hiddenDeductions: string[] | null;

  @OneToMany(() => RegulationDocument, (document) => document.regulation)
  documents: RegulationDocument[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

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

// Config de regulamento de um evento (documentos) — 1:1 com Event,
// endereçada sempre por eventId (nunca pelo próprio id, ver
// RegulationsService). Não existe até o primeiro upload — GET devolve
// uma view sintética antes disso. As regras de dedução MORARAM daqui
// pra ScoringTemplate.deductions (2026-09-23, ver CLAUDE.md) — quem
// determina as deduções é o sistema de pontuação, não o evento.
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

  @OneToMany(() => RegulationDocument, (document) => document.regulation)
  documents: RegulationDocument[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

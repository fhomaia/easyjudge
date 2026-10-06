import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { RegistrationRequirement } from '../registration-requirements';

// Configuração da inscrição de UM evento (aliasId, sem FK, mesmo padrão
// de CategoryCriteriaSettings): dados e documentos pedidos aos atletas e
// se o programa pode enviar a ficha sem todos os documentos. Sem
// linha = padrão (nada pedido). Depois: pagamento.
@Entity('registration_settings')
export class RegistrationSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  @Column({ name: 'allow_submit_without_documents', default: false })
  allowSubmitWithoutDocuments: boolean;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  requirements: RegistrationRequirement[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

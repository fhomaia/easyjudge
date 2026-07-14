import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Regulation } from './regulation.entity';
import { RegulationDocumentKind } from '../enums/regulation-document-kind.enum';

@Entity('regulation_documents')
export class RegulationDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'regulation_id' })
  regulationId: string;

  @ManyToOne(() => Regulation, (regulation) => regulation.documents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'regulation_id' })
  regulation: Regulation;

  @Column({ type: 'enum', enum: RegulationDocumentKind })
  kind: RegulationDocumentKind;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'file_url', type: 'varchar' })
  fileUrl: string;

  @Column({ name: 'mime_type', length: 100 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

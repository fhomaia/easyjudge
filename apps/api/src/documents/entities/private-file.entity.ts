import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// Arquivo guardado no armazenamento PRIVADO (bucket R2 sem acesso público;
// em dev, pasta `private-uploads/` que o servidor não expõe). Só sai pela
// API, depois de conferir quem pede. Referenciado pela biblioteca do
// atleta (UserDocument) e pelos documentos enviados num evento
// (AthleteRequirementDocument.fileKeys); a limpeza periódica apaga o
// arquivo quando nada mais aponta pra ele (DocumentsCleanupService).
@Entity('private_files')
export class PrivateFile {
  @PrimaryColumn({ type: 'varchar', length: 200 })
  key: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'integer' })
  size: number;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

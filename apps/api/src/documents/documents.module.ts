import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrivateFile } from './entities/private-file.entity';
import { UserDocument } from './entities/user-document.entity';
import { PrivateFilesService } from './services/private-files.service';
import { UserDocumentsService } from './services/user-documents.service';
import { DocumentsCleanupService } from './services/documents-cleanup.service';
import { UserDocumentsController } from './controllers/user-documents.controller';

// Arquivos privados, biblioteca de documentos do atleta e limpeza
// periódica (2026-10-06). Os documentos enviados a um evento ficam em
// `programs` (AthleteDocumentsService), que importa este módulo.
@Module({
  imports: [TypeOrmModule.forFeature([PrivateFile, UserDocument])],
  controllers: [UserDocumentsController],
  providers: [
    PrivateFilesService,
    UserDocumentsService,
    DocumentsCleanupService,
  ],
  exports: [PrivateFilesService, UserDocumentsService],
})
export class DocumentsModule {}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserDocument } from '../entities/user-document.entity';
import {
  PrivateFilesService,
  type PrivateFileView,
} from './private-files.service';
import { assertAthleteDocumentFiles } from '../../common/config/athlete-document-upload.config';

export interface UserDocumentView {
  id: string;
  label: string | null;
  file: PrivateFileView;
  createdAt: Date;
}

// Biblioteca de documentos da conta (ver UserDocument).
@Injectable()
export class UserDocumentsService {
  constructor(
    @InjectRepository(UserDocument)
    private readonly documentsRepo: Repository<UserDocument>,
    private readonly privateFiles: PrivateFilesService,
  ) {}

  async list(userId: string): Promise<UserDocumentView[]> {
    const docs = await this.documentsRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return this.toViews(docs);
  }

  async upload(
    userId: string,
    files: Express.Multer.File[] | undefined,
    label: string | null,
  ): Promise<UserDocumentView[]> {
    const list = assertAthleteDocumentFiles(files);
    const created: UserDocument[] = [];
    for (const file of list) {
      created.push(await this.addFile(userId, file, label));
    }
    return this.toViews(created);
  }

  // Um arquivo novo na biblioteca (também usado quando o atleta envia
  // arquivo novo pra um evento).
  async addFile(
    userId: string,
    file: Express.Multer.File,
    label: string | null,
  ): Promise<UserDocument> {
    const saved = await this.privateFiles.save(file, `users/${userId}`, userId);
    return this.addExisting(userId, saved.key, label);
  }

  async addExisting(
    userId: string,
    fileKey: string,
    label: string | null,
  ): Promise<UserDocument> {
    return this.documentsRepo.save(
      this.documentsRepo.create({
        userId,
        fileKey,
        label: label?.trim().slice(0, 120) || null,
      }),
    );
  }

  // Documentos do próprio usuário (404 pra id de outra pessoa).
  async findOwned(userId: string, ids: string[]): Promise<UserDocument[]> {
    if (ids.length === 0) return [];
    const docs = await this.documentsRepo.findBy({ id: In(ids), userId });
    if (docs.length !== new Set(ids).size) {
      throw new NotFoundException('Documento não encontrado.');
    }
    return ids.map((id) => docs.find((d) => d.id === id) as UserDocument);
  }

  async remove(userId: string, id: string): Promise<void> {
    const [doc] = await this.findOwned(userId, [id]);
    // Só a entrada da biblioteca: o arquivo continua nos eventos em que
    // foi enviado e sai na limpeza quando nada mais aponta pra ele.
    await this.documentsRepo.remove(doc);
  }

  async stream(userId: string, id: string) {
    const [doc] = await this.findOwned(userId, [id]);
    return this.privateFiles.stream(doc.fileKey);
  }

  private async toViews(docs: UserDocument[]): Promise<UserDocumentView[]> {
    const files = await this.privateFiles.findByKeys(
      docs.map((d) => d.fileKey),
    );
    return docs
      .filter((d) => files.has(d.fileKey))
      .map((d) => ({
        id: d.id,
        label: d.label,
        file: PrivateFilesService.view(files.get(d.fileKey)!),
        createdAt: d.createdAt,
      }));
  }
}

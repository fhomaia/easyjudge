import { Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PrivateFile } from '../entities/private-file.entity';
import { StorageService } from '../../common/services/storage.service';
import { originalFileName } from '../../common/config/athlete-document-upload.config';

export interface PrivateFileView {
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

// Arquivos privados (ver PrivateFile): grava no armazenamento e registra.
// Quem chama confere a permissão antes de entregar um arquivo.
@Injectable()
export class PrivateFilesService {
  constructor(
    @InjectRepository(PrivateFile)
    private readonly filesRepo: Repository<PrivateFile>,
    private readonly storageService: StorageService,
  ) {}

  async save(
    file: Express.Multer.File,
    folder: string,
    userId: string,
  ): Promise<PrivateFile> {
    const key = await this.storageService.uploadPrivate(file, folder);
    return this.filesRepo.save(
      this.filesRepo.create({
        key,
        fileName: originalFileName(file),
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: userId,
      }),
    );
  }

  async findByKeys(keys: string[]): Promise<Map<string, PrivateFile>> {
    if (keys.length === 0) return new Map();
    const rows = await this.filesRepo.findBy({ key: In([...new Set(keys)]) });
    return new Map(rows.map((r) => [r.key, r]));
  }

  async stream(key: string): Promise<StreamableFile> {
    const file = await this.filesRepo.findOneBy({ key });
    if (!file) throw new NotFoundException('Arquivo não encontrado.');
    const body = await this.storageService.downloadPrivate(key);
    return new StreamableFile(body, {
      type: file.mimeType,
      length: file.size,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    });
  }

  static view(file: PrivateFile): PrivateFileView {
    return {
      key: file.key,
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.size,
      createdAt: file.createdAt,
    };
  }
}

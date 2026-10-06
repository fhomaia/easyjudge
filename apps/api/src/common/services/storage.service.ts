import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'stream';
import { randomUUID } from 'crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { extname, join } from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string | null;
  private readonly publicUrl: string | null;
  // Bucket PRIVADO (documentos dos atletas, 2026-10-06): sem acesso
  // público, os arquivos só saem pela API (downloadPrivate).
  private readonly privateS3: S3Client | null;
  private readonly privateBucket: string | null;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );
    this.bucket = this.configService.get<string>('R2_BUCKET') ?? null;
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL') ?? null;

    this.privateBucket =
      this.configService.get<string>('R2_PRIVATE_BUCKET') || null;
    this.privateS3 =
      accountId && accessKeyId && secretAccessKey && this.privateBucket
        ? new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;

    if (
      accountId &&
      accessKeyId &&
      secretAccessKey &&
      this.bucket &&
      this.publicUrl
    ) {
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.s3 = null;
      // Sem credenciais R2 configuradas (ex: clone novo do repo sem
      // .env preenchido) — cai pro disco local, mesmo comportamento de
      // antes do R2 existir. Não trava o dev local.
      this.logger.warn(
        'Credenciais R2 não configuradas — uploads vão pro disco local (modo dev).',
      );
    }
  }

  async upload(file: Express.Multer.File, folder: string): Promise<string> {
    const filename = `${randomUUID()}${extname(file.originalname)}`;

    if (this.s3 && this.bucket && this.publicUrl) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: `${folder}/${filename}`,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      return `${this.publicUrl}/${folder}/${filename}`;
    }

    const dir = join(process.cwd(), 'uploads', folder);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, filename), file.buffer);
    return `/uploads/${folder}/${filename}`;
  }

  // Arquivo privado: devolve a chave (nunca uma URL). Em dev sem bucket
  // privado, grava em `private-uploads/`, pasta que o servidor NÃO serve
  // (diferente de `uploads/`).
  async uploadPrivate(
    file: Express.Multer.File,
    folder: string,
  ): Promise<string> {
    const key = `${folder}/${randomUUID()}${extname(file.originalname).toLowerCase()}`;
    if (this.privateS3 && this.privateBucket) {
      await this.privateS3.send(
        new PutObjectCommand({
          Bucket: this.privateBucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      return key;
    }
    // Produção (R2 público configurado) sem bucket privado: recusa em vez
    // de gravar no disco do servidor, que some a cada deploy.
    if (this.s3) {
      throw new InternalServerErrorException(
        'Armazenamento de documentos não configurado (R2_PRIVATE_BUCKET).',
      );
    }
    const path = this.localPrivatePath(key);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, file.buffer);
    return key;
  }

  async downloadPrivate(key: string): Promise<Readable> {
    if (this.privateS3 && this.privateBucket) {
      const result = await this.privateS3.send(
        new GetObjectCommand({ Bucket: this.privateBucket, Key: key }),
      );
      return result.Body as Readable;
    }
    return createReadStream(this.localPrivatePath(key));
  }

  async deletePrivate(key: string): Promise<void> {
    if (this.privateS3 && this.privateBucket) {
      await this.privateS3.send(
        new DeleteObjectCommand({ Bucket: this.privateBucket, Key: key }),
      );
      return;
    }
    const path = this.localPrivatePath(key);
    if (existsSync(path)) rmSync(path);
  }

  private localPrivatePath(key: string): string {
    // A chave é sempre gerada aqui (pasta/uuid.ext); o replace é só defesa.
    return join(process.cwd(), 'private-uploads', key.replace(/\.\./g, ''));
  }
}

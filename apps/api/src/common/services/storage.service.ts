import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string | null;
  private readonly publicUrl: string | null;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );
    this.bucket = this.configService.get<string>('R2_BUCKET') ?? null;
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL') ?? null;

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
}

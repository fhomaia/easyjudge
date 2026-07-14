import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const DOCUMENT_UPLOAD_DIR = join(
  process.cwd(),
  'uploads',
  'regulation-documents',
);

export const documentUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      mkdirSync(DOCUMENT_UPLOAD_DIR, { recursive: true });
      callback(null, DOCUMENT_UPLOAD_DIR);
    },
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(
        new BadRequestException(
          'Formato de documento não suportado. Use PDF, JPEG ou PNG.',
        ),
        false,
      );
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
};

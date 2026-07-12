import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const LOGO_UPLOAD_DIR = join(process.cwd(), 'uploads', 'logos');

export const logoUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      mkdirSync(LOGO_UPLOAD_DIR, { recursive: true });
      callback(null, LOGO_UPLOAD_DIR);
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
          'Formato de imagem não suportado. Use PNG, JPEG, WEBP ou SVG.',
        ),
        false,
      );
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
};

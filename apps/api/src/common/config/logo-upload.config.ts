import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const logoUploadOptions = {
  storage: memoryStorage(),
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

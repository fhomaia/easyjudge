import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const documentUploadOptions = {
  storage: memoryStorage(),
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

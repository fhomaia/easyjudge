import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
// 10MB era pequeno demais pra documento oficial de regras de segurança
// digitalizado (regulamento/PDF escaneado facilmente passa de 20MB) —
// subido pra 30MB (2026-09-23, a pedido do usuário, depois de um
// upload de 24,4MB ser recusado).
const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024; // 30MB

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

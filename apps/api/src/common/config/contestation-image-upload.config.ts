import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

// Imagens anexadas à contestação (2026-09-28). Só imagem: vídeo e outros
// formatos são recusados com mensagem própria (a tela já avisa antes).
export const CONTESTATION_MAX_IMAGES = 5;
export const CONTESTATION_MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
// Tetos do multer acima dos limites reais: assim quantidade e tamanho são
// conferidos em ScoringService.requestContestation, com mensagem em
// português (o multer responde "Too many files"/"File too large").
export const CONTESTATION_UPLOAD_HARD_MAX_FILES = 20;
const HARD_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

export const contestationImageUploadOptions = {
  storage: memoryStorage(),
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(
        new BadRequestException(
          'Só é possível anexar imagens (JPG, PNG, WEBP ou GIF). Vídeos e outros arquivos não são aceitos.',
        ),
        false,
      );
      return;
    }
    callback(null, true);
  },
  limits: {
    fileSize: HARD_MAX_FILE_SIZE_BYTES,
    files: CONTESTATION_UPLOAD_HARD_MAX_FILES,
  },
};

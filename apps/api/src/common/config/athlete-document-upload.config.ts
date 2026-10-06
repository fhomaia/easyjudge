import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

// Documentos dos atletas (2026-10-06): PDF ou foto (frente e verso viram
// dois arquivos). Quantidade e tamanho conferidos no service, com mensagem
// em português (o multer responde em inglês), por isso os tetos daqui são
// mais altos que os limites reais.
export const ATHLETE_DOCUMENT_MAX_FILES = 4;
export const ATHLETE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024; // 10MB
export const ATHLETE_DOCUMENT_HARD_MAX_FILES = 10;
export const ATHLETE_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

export const athleteDocumentUploadOptions = {
  storage: memoryStorage(),
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ATHLETE_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
      callback(
        new BadRequestException(
          'Formato não aceito. Envie PDF ou foto (JPG, PNG, WEBP ou HEIC).',
        ),
        false,
      );
      return;
    }
    callback(null, true);
  },
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: ATHLETE_DOCUMENT_HARD_MAX_FILES,
  },
};

// Nome do arquivo como o navegador mandou (o multer entrega em latin1).
export function originalFileName(file: Express.Multer.File): string {
  const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
  return (decoded.includes('�') ? file.originalname : decoded).slice(0, 255);
}

export function assertAthleteDocumentFiles(
  files: Express.Multer.File[] | undefined,
  { allowEmpty = false } = {},
): Express.Multer.File[] {
  const list = files ?? [];
  if (!allowEmpty && list.length === 0) {
    throw new BadRequestException('Escolha ao menos um arquivo.');
  }
  if (list.length > ATHLETE_DOCUMENT_MAX_FILES) {
    throw new BadRequestException(
      `No máximo ${ATHLETE_DOCUMENT_MAX_FILES} arquivos por documento.`,
    );
  }
  for (const file of list) {
    if (file.size > ATHLETE_DOCUMENT_MAX_BYTES) {
      throw new BadRequestException(
        `"${originalFileName(file)}" passa de 10 MB.`,
      );
    }
  }
  return list;
}

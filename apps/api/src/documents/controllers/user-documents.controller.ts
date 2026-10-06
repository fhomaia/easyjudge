import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';
import { UserRole } from '../../common/enums/user-role.enum';
import {
  ATHLETE_DOCUMENT_HARD_MAX_FILES,
  athleteDocumentUploadOptions,
} from '../../common/config/athlete-document-upload.config';
import { UserDocumentsService } from '../services/user-documents.service';

// Biblioteca de documentos da própria conta ("Meus documentos" no perfil).
// Qualquer conta que pode ser atleta (todas menos Programa).
@Controller('me/documents')
@UseGuards(JwtAuthGuard)
export class UserDocumentsController {
  constructor(private readonly documentsService: UserDocumentsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    this.assertAthleteAccount(req);
    return this.documentsService.list(req.user.userId);
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor(
      'files',
      ATHLETE_DOCUMENT_HARD_MAX_FILES,
      athleteDocumentUploadOptions,
    ),
  )
  upload(
    @Req() req: AuthenticatedRequest,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('label') label?: string,
  ) {
    this.assertAthleteAccount(req);
    return this.documentsService.upload(req.user.userId, files, label ?? null);
  }

  @Get(':id/file')
  file(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.stream(req.user.userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.remove(req.user.userId, id);
  }

  private assertAthleteAccount(req: AuthenticatedRequest) {
    if (req.user.role === UserRole.PROGRAM) {
      throw new ForbiddenException(
        'Conta Programa não tem documentos de atleta.',
      );
    }
  }
}

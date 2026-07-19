import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RegulationsService } from '../services/regulations.service';
import { UpdateRegulationDto } from '../dto/update-regulation.dto';
import { RegulationDocumentKind } from '../enums/regulation-document-kind.enum';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { documentUploadOptions } from '../../common/config/document-upload.config';
import { EventMemberGuard } from '../../events/guards/event-member.guard';
import { EventRoles } from '../../events/decorators/event-roles.decorator';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';

@Controller('events/:eventId/regulation')
@UseGuards(JwtAuthGuard, RolesGuard, EventMemberGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
@EventRoles(EventMemberRole.ADMIN, EventMemberRole.ASSESSOR)
export class RegulationsController {
  constructor(private readonly regulationsService: RegulationsService) {}

  @Get()
  get(@Param('eventId') eventId: string) {
    return this.regulationsService.getForEvent(eventId);
  }

  @Patch()
  update(@Param('eventId') eventId: string, @Body() dto: UpdateRegulationDto) {
    return this.regulationsService.updateDeductions(eventId, dto);
  }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file', documentUploadOptions))
  uploadDocument(
    @Param('eventId') eventId: string,
    @Body('kind') kind: string,
    @Body('name') name: string | undefined,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatório');
    if (
      !Object.values(RegulationDocumentKind).includes(
        kind as RegulationDocumentKind,
      )
    ) {
      throw new BadRequestException('Tipo de documento inválido');
    }
    return this.regulationsService.uploadDocument(
      eventId,
      kind as RegulationDocumentKind,
      file,
      name,
    );
  }

  @Delete('documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDocument(
    @Param('eventId') eventId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.regulationsService.deleteDocument(eventId, documentId);
  }
}

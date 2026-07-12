import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventsService } from '../services/events.service';
import { CreateEventDto } from '../dto/create-event.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';
import { logoUploadOptions } from '../../common/config/logo-upload.config';

// Jornada "criar evento": registrar evento -> regulamento (futuro) ->
// categorias (ver categories/) -> equipes (ver teams/). Jurado e
// organização têm as mesmas permissões aqui (ver CLAUDE.md).
@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEventDto, @Req() req: AuthenticatedRequest) {
    return this.eventsService.createEvent(dto, req.user.userId);
  }

  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Post(':id/logo')
  @Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
  @UseInterceptors(FileInterceptor('file', logoUploadOptions))
  setEventLogo(
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo de logo obrigatório');
    return this.eventsService.setEventLogo(id, file);
  }
}

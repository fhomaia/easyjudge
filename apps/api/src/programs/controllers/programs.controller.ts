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
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProgramsService } from '../services/programs.service';
import { CreateProgramParticipationDto } from '../dto/create-program-participation.dto';
import { UpdateProgramParticipationDto } from '../dto/update-program-participation.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { logoUploadOptions } from '../../common/config/logo-upload.config';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

@Controller('events/:eventId/programs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateProgramParticipationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.programsService.create(eventId, dto, req.user.userId);
  }

  @Get()
  findAll(@Param('eventId') eventId: string) {
    return this.programsService.findAllForEvent(eventId);
  }

  @Get(':id')
  findOne(@Param('eventId') eventId: string, @Param('id') id: string) {
    return this.programsService.findOneForEvent(eventId, id);
  }

  @Patch(':id')
  update(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProgramParticipationDto,
  ) {
    return this.programsService.update(eventId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('eventId') eventId: string, @Param('id') id: string) {
    return this.programsService.remove(eventId, id);
  }

  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file', logoUploadOptions))
  setLogo(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo de logo obrigatório');
    return this.programsService.setLogo(eventId, id, file);
  }
}

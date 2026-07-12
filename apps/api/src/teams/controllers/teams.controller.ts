import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TeamsService } from '../services/teams.service';
import { CreateTeamDto } from '../dto/create-team.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { logoUploadOptions } from '../../common/config/logo-upload.config';

@Controller('events/:eventId/teams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
  @HttpCode(HttpStatus.CREATED)
  create(@Param('eventId') eventId: string, @Body() dto: CreateTeamDto) {
    return this.teamsService.create(eventId, dto);
  }

  @Post(':teamId/logo')
  @Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
  @UseInterceptors(FileInterceptor('file', logoUploadOptions))
  setLogo(
    @Param('eventId') eventId: string,
    @Param('teamId') teamId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo de logo obrigatório');
    return this.teamsService.setLogo(eventId, teamId, file);
  }
}

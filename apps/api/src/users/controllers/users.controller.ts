import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { PasswordConfirmationDto } from '../dto/password-confirmation.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserRole } from '../../common/enums/user-role.enum';
import { logoUploadOptions } from '../../common/config/logo-upload.config';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';
import type { User } from '../entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Formato de resposta compartilhado por GET/PATCH/avatar — mesmo
  // shape em todo endpoint de "me" pra facilitar o frontend só
  // substituir o profile inteiro no estado local depois de qualquer
  // mutação.
  private async serializeProfile(user: User) {
    const hasConfirmedAthleteLink =
      user.role === UserRole.ATHLETE
        ? await this.usersService.hasConfirmedAthleteLink(user.id)
        : false;
    return {
      id: user.id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      documentType: user.documentType,
      documentNumber: user.documentNumber,
      birthDate: user.birthDate,
      hasConfirmedAthleteLink,
    };
  }

  @Get('me')
  async me(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return this.serializeProfile(user);
  }

  @Patch('me')
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.usersService.updateProfile(req.user.userId, dto);
    return this.serializeProfile(user);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(req.user.userId, dto);
  }

  @Post('me/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivateAccount(
    @Req() req: AuthenticatedRequest,
    @Body() dto: PasswordConfirmationDto,
  ) {
    return this.usersService.deactivateAccount(req.user.userId, dto);
  }

  @Post('me/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAccount(
    @Req() req: AuthenticatedRequest,
    @Body() dto: PasswordConfirmationDto,
  ) {
    return this.usersService.deleteAccount(req.user.userId, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', logoUploadOptions))
  async setAvatar(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo de foto obrigatório');
    const user = await this.usersService.setAvatar(req.user.userId, file);
    return this.serializeProfile(user);
  }

  @Delete('me/avatar')
  async removeAvatar(@Req() req: AuthenticatedRequest) {
    await this.usersService.removeAvatar(req.user.userId);
    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return this.serializeProfile(user);
  }
}

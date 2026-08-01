import { IsString } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/strong-password.validator';
import { Match } from '../../common/validators/match.validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @IsStrongPassword()
  newPassword: string;

  @IsString()
  @Match('newPassword', { message: 'As senhas não coincidem.' })
  confirmPassword: string;
}

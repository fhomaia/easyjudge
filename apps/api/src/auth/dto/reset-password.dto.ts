import { IsString, IsUUID } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/strong-password.validator';
import { Match } from '../../common/validators/match.validator';

export class ResetPasswordDto {
  @IsUUID()
  resetId: string;

  @IsString()
  @IsStrongPassword()
  password: string;

  @IsString()
  @Match('password', { message: 'As senhas não coincidem.' })
  confirmPassword: string;
}

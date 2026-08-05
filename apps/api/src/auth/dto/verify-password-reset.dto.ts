import { IsString, IsUUID, Length } from 'class-validator';

export class VerifyPasswordResetDto {
  @IsUUID()
  resetId: string;

  @IsString()
  @Length(6, 6, { message: 'O código deve ter 6 dígitos.' })
  code: string;
}

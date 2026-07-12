import { IsString, IsUUID, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsUUID()
  userId: string;

  @IsString()
  @Length(6, 6, { message: 'O código deve ter 6 dígitos.' })
  code: string;
}

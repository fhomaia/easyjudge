import { IsEmail } from 'class-validator';

export class ImpersonateDto {
  @IsEmail()
  email: string;
}

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ContactSupportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}

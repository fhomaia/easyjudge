import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  // UF, ex: "SP", "RJ"
  @IsString()
  @Length(2, 2)
  state: string;
}

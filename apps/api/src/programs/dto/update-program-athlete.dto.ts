import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Mesmas regras de CreateProgramAthleteDto, tudo opcional. `null` em
// cpf/birthDate apaga o valor.
export class UpdateProgramAthleteDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @Matches(/^\d{11}$/, { message: 'CPF deve ter 11 dígitos.' })
  cpf?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  birthDate?: string | null;
}

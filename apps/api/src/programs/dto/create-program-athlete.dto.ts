import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Atleta inscrito pelo programa no evento (ProgramAthlete). Nome e email
// obrigatórios; CPF e nascimento opcionais (decisão do usuário,
// 2026-10-04). `null` em cpf/birthDate apaga o valor numa edição.
export class CreateProgramAthleteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @Matches(/^\d{11}$/, { message: 'CPF deve ter 11 dígitos.' })
  cpf?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  birthDate?: string | null;
}

import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateProgramParticipationDto {
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

  // Presente só quando o organizador escolheu um usuário role PROGRAM
  // já cadastrado em vez de digitar os dados manualmente — validado
  // em ProgramsService (existe e tem o role certo).
  @IsOptional()
  @IsUUID()
  userId?: string;
}

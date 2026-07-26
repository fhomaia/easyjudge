import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Programa adicionando um atleta ao próprio elenco (nome/sobrenome/email)
// — ver AthleteRosterController.
export class CreateAthleteLinkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsEmail()
  email: string;
}

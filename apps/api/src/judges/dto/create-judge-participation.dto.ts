import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateJudgeParticipationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsEmail()
  email: string;

  // Presente só quando o organizador escolheu um usuário role JUDGE já
  // cadastrado em vez de digitar os dados manualmente — validado em
  // JudgesService (existe e tem o role certo).
  @IsOptional()
  @IsUUID()
  userId?: string;
}

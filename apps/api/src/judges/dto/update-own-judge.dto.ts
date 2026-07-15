import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Edita o JudgeProfile (perfil canônico), não uma linha
// JudgeParticipation de evento — por isso "email" aqui é o
// contactEmail do perfil, separado do email de login da conta
// (User.email).
export class UpdateOwnJudgeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;
}

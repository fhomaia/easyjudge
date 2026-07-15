import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

// Edita o ProgramProfile (perfil canônico), não uma linha Program de
// evento — por isso "email" aqui é o contactEmail do perfil, separado
// do email de login da conta (User.email), e não tem userId (o
// próprio programa não pode se revincular a outra conta por essa
// rota).
export class UpdateOwnProgramDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  state?: string;
}

import { IsEmail } from 'class-validator';

// Atleta pedindo vínculo a um programa por email — usado tanto no
// AuthService.setPassword (vínculo inicial do cadastro) quanto em
// AthleteProgramsController (pra adicionar mais um programa depois).
export class RequestProgramLinkDto {
  @IsEmail()
  programEmail: string;
}

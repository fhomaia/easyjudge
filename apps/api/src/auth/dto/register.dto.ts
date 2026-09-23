import {
  Equals,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';
import { DocumentType } from '../../common/enums/document-type.enum';
import { IsValidDocument } from '../../common/validators/document.validator';

// Atleta (inclui "espectador" da tela de cadastro, que chega aqui como
// role=athlete — ver RegisterDialog no frontend) e programa/ginásio
// podem deixar o documento em branco; os demais continuam obrigatórios.
// Regra de "só CPF" pra atleta é reforçada em AuthService.register (não
// dá pra restringir o enum do @IsEnum condicionalmente por valor aqui
// sem duplicar toda a lógica de ValidateIf) — programa continua podendo
// informar CPF OU CNPJ quando decide preencher (2026-09-24, pedido do
// usuário: reduzir atrito de quem não tem CNPJ à mão pra se cadastrar
// rápido antes de um evento; documentNumber não é usado em nenhuma
// outra parte do sistema além de "Meu perfil", que já trata ausência).
function isDocumentOptional(o: RegisterDto): boolean {
  return o.role === UserRole.ATHLETE || o.role === UserRole.PROGRAM;
}

// Programa/ginásio é uma instituição, não uma pessoa — o cadastro só
// pede um nome só (etapa "lastName" pulada no frontend pra esse papel,
// ver RegisterDialog), então `lastName` chega como string vazia. Só
// esse papel dispensa a validação; os demais continuam exigindo nome +
// sobrenome.
function isLastNameOptional(o: RegisterDto): boolean {
  return o.role === UserRole.PROGRAM;
}

export class RegisterDto {
  @IsEnum(UserRole)
  role: UserRole;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ValidateIf((o: RegisterDto) => !isLastNameOptional(o))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ValidateIf((o: RegisterDto) => !isDocumentOptional(o) || !!o.documentNumber)
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @ValidateIf((o: RegisterDto) => !isDocumentOptional(o) || !!o.documentType)
  @IsString()
  @IsNotEmpty()
  @IsValidDocument('documentType')
  documentNumber?: string;

  // Só faz sentido pra quem usa CPF (pedido de LGPD) — uma instituição
  // com CNPJ não tem data de nascimento. Atleta (inclui "espectador" do
  // frontend) sempre exige, mesmo com documentType ausente (documento
  // opcional pra esse papel, mas quando informado é sempre CPF — ver
  // isDocumentOptional acima) — não faz sentido condicionar à presença
  // do CPF quando o tipo já é sempre CPF pra esse grupo. Validação de
  // "não pode ser no futuro" fica em AuthService.register (IsDateString
  // só confere formato ISO, não faixa de valor).
  @ValidateIf(
    (o: RegisterDto) =>
      o.documentType === DocumentType.CPF || o.role === UserRole.ATHLETE,
  )
  @IsDateString()
  birthDate?: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  teamOrInstitutionName?: string;

  // Só relevante pra role=athlete — email do programa a que o atleta
  // quer se vincular (pedido fica pendente de confirmação, ver
  // AuthService.setPassword/AthletesService.createOrRequestLink).
  @IsOptional()
  @IsEmail()
  programEmail?: string;

  // Checkbox de aceite dos Termos de Uso/Política de Privacidade
  // (RegisterDialog trava o botão de confirmar até marcar) — `@Equals`
  // em vez de `@IsBoolean` de propósito: `false` explícito também deve
  // ser rejeitado, não só ausência do campo. Timestamp do aceite fica
  // em User.termsAcceptedAt (ver UsersService.createPendingUser).
  @Equals(true)
  acceptedTerms: boolean;
}

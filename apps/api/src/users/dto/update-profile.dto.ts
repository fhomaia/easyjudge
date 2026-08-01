import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { DocumentType } from '../../common/enums/document-type.enum';
import { IsValidDocument } from '../../common/validators/document.validator';

// Documento/data de nascimento só passam por aqui pra PREENCHER quem
// ficou sem informar no cadastro (role=athlete, ver RegisterDto) — o
// service (UsersService.updateProfile) rejeita tentativa de alterar um
// valor já existente, então esses dois campos só fazem sentido quando
// o usuário ainda não tem CPF/data salvos.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ValidateIf((o: UpdateProfileDto) => !!o.documentNumber)
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @ValidateIf((o: UpdateProfileDto) => !!o.documentType)
  @IsString()
  @IsValidDocument('documentType')
  documentNumber?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;
}

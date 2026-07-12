import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';
import { DocumentType } from '../../common/enums/document-type.enum';
import { IsValidDocument } from '../../common/validators/document.validator';

export class RegisterDto {
  @IsEnum(UserRole)
  role: UserRole;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsString()
  @IsNotEmpty()
  @IsValidDocument('documentType')
  documentNumber: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  teamOrInstitutionName?: string;
}

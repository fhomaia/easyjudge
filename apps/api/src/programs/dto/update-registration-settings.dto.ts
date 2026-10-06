import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class RegistrationRequirementDto {
  // Ausente/desconhecido = nova (id gerado no servidor).
  @IsOptional()
  @IsString()
  @MaxLength(60)
  id?: string | null;

  @IsIn(['document', 'text', 'select', 'date'])
  kind: 'document' | 'text' | 'select' | 'date';

  @IsOptional()
  @IsIn([
    'birth_date',
    'identity',
    'school_proof',
    'university_proof',
    'cpf',
    'phone',
    'emergency_contact',
  ])
  preset?: string | null;

  @IsString()
  @MaxLength(60)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @IsBoolean()
  required: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  options?: string[];

  // { critério: [ids das opções] }, conferido no service.
  @IsOptional()
  @IsObject()
  appliesTo?: Record<string, string[]> | null;
}

export class UpdateRegistrationSettingsDto {
  @IsBoolean()
  allowSubmitWithoutDocuments: boolean;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RegistrationRequirementDto)
  requirements: RegistrationRequirementDto[];
}

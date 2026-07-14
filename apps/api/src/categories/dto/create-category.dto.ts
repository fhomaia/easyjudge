import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CategoryModality } from '../enums/category-modality.enum';
import { CategoryDivision } from '../enums/category-division.enum';
import { CategoryFormat } from '../enums/category-format.enum';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsEnum(CategoryModality)
  modality: CategoryModality;

  @IsEnum(CategoryDivision)
  division: CategoryDivision;

  @IsEnum(CategoryFormat)
  categoryFormat: CategoryFormat;

  // Obrigatório só quando categoryFormat = 'custom' (validado no
  // formulário também, mas repetido aqui pra não depender só do front).
  @ValidateIf((dto) => dto.categoryFormat === CategoryFormat.CUSTOM)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customFormatLabel?: string;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(7)
  level: number;

  @IsOptional()
  @IsBoolean()
  nonTumbling?: boolean;

  // Precisa ser um template do próprio usuário e "completo" (soma dos
  // critérios-raiz == targetScore) — validado em
  // ScoringTemplatesService.assertUsableTemplate, não só aqui.
  @IsUUID()
  scoringTemplateId: string;

  @IsInt()
  @Min(1)
  presentationTimeSeconds: number;
}

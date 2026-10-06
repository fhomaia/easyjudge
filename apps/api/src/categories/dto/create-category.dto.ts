import {
  IsDateString,
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
import { CategoryFormat } from '../enums/category-format.enum';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsEnum(CategoryFormat)
  categoryFormat: CategoryFormat;

  // Obrigatório só quando categoryFormat = 'custom' (validado no
  // formulário também, mas repetido aqui pra não depender só do front).
  @ValidateIf((dto) => dto.categoryFormat === CategoryFormat.CUSTOM)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customFormatLabel?: string;

  // Critérios de divisão: id de uma opção da configuração do evento
  // (validado em CategoriesService contra os critérios ligados; os
  // desligados são ignorados).
  @IsOptional()
  @IsString()
  @MaxLength(60)
  institution?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  regime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ageGroup?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  gender?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  size?: string | null;

  // Regra direta da categoria (sem divisão de Tamanho/Faixa etária).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  minAthletes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  maxAthletes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  minAge?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  maxAge?: number | null;

  @IsOptional()
  @IsDateString({ strict: true })
  ageCutoffDate?: string | null;

  // Construção.tumbling (ex.: 4.2), ver levelProblem. Até 7.7.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(7.7)
  level?: number | null;

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

  @IsInt()
  @Min(1)
  warmupMinutes: number;
}

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CategoryCriterionKey } from '../enums/category-criterion-key.enum';

export class CategoryCriterionOptionDto {
  // Ausente/null = opção nova (o id é gerado no servidor).
  @IsOptional()
  @IsString()
  @MaxLength(60)
  id?: string | null;

  // Vem da leitura (opção padrão); ignorado na gravação.
  @IsOptional()
  @IsBoolean()
  builtIn?: boolean;

  // Obrigatório, menos no Nível (montado a partir do número).
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  // Nível: construção.tumbling (4.2) e "sem tumbling".
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(7.7)
  level?: number | null;

  @IsOptional()
  @IsBoolean()
  nonTumbling?: boolean;

  // Faixa etária.
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

  // Tamanho.
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
}

export class CategoryCriterionDto {
  @IsEnum(CategoryCriterionKey)
  key: CategoryCriterionKey;

  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => CategoryCriterionOptionDto)
  options: CategoryCriterionOptionDto[];

  @IsOptional()
  @IsDateString({ strict: true })
  ageCutoffDate?: string | null;
}

// A lista inteira de critérios do evento, cada um uma vez.
export class UpdateCategoryCriteriaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryCriterionDto)
  criteria: CategoryCriterionDto[];
}

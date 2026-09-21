import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { RegulationDeductionMode } from '../enums/regulation-deduction-mode.enum';

export class CustomDeductionDto {
  // Ausente = tipo novo (o servidor gera o id). Presente = mantém o
  // tipo existente, mesmo renomeando (as notas apontam pra este id).
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label: string;

  // Magnitude em pontos. O sinal é ignorado: deduções SEMPRE subtraem
  // (ver RegulationsService.toDeductionValue).
  @IsNumber()
  value: number;
}

export class UpdateRegulationDto {
  @IsOptional()
  @IsEnum(RegulationDeductionMode)
  deductionMode?: RegulationDeductionMode;

  // Validação fina (só aceitar chaves de DeductionType, valores
  // numéricos) fica no service — um objeto parcial e livre não tem um
  // decorator pronto do class-validator pra validar "cada valor é
  // number", então filtramos na mão em RegulationsService.
  @IsOptional()
  @IsObject()
  deductionValues?: Record<string, number>;

  // Lista COMPLETA dos tipos personalizados (substitui a anterior).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CustomDeductionDto)
  customDeductions?: CustomDeductionDto[];

  // Lista COMPLETA dos tipos padrão removidos (só no modo "custom").
  // Vazia = todos restaurados.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  hiddenDeductions?: string[];
}

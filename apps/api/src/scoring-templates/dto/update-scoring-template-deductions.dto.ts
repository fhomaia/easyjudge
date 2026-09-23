import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class TemplateDeductionDto {
  // Ausente = regra nova (o servidor gera o id). Presente = mantém a
  // regra existente, mesmo renomeando (as notas apontam pra este id).
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label: string;

  // Magnitude em pontos. O sinal é ignorado: deduções SEMPRE subtraem
  // (ver ScoringTemplatesService.toDeductionValue).
  @IsNumber()
  value: number;

  // Exige especificação na tela do jurado de legalidade (ver
  // TemplateDeduction.requiresCode). Ausente = false.
  @IsOptional()
  @IsBoolean()
  requiresCode?: boolean;
}

export class UpdateScoringTemplateDeductionsDto {
  // Lista COMPLETA das regras de dedução do template (substitui a
  // anterior) — precisa sobrar ao menos uma, senão o jurado de
  // legalidade fica sem nada pra aplicar.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => TemplateDeductionDto)
  deductions: TemplateDeductionDto[];
}

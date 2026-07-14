import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ScoringCriterionType } from '../enums/scoring-criterion-type.enum';

// parentId de propósito não entra aqui — reparenting só acontece via
// o endpoint /move, pra manter a renumeração de order num único lugar.
export class UpdateScoringCriterionDto {
  @IsOptional()
  @IsEnum(ScoringCriterionType)
  type?: ScoringCriterionType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  maxScore?: number;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsBoolean()
  showInJudgingSheet?: boolean;

  @IsOptional()
  @IsBoolean()
  allowDecimalScoring?: boolean;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

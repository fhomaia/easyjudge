import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ScoringCriterionType } from '../enums/scoring-criterion-type.enum';

export class CreateScoringCriterionDto {
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsEnum(ScoringCriterionType)
  type: ScoringCriterionType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  maxScore: number;

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

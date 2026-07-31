import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ScoringCriterionType } from '../enums/scoring-criterion-type.enum';
import { ScoreBandDto } from './score-band.dto';

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

  @IsOptional()
  @IsBoolean()
  useScoreBands?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScoreBandDto)
  scoreBands?: ScoreBandDto[];
}

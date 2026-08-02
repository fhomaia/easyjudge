import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ScoringCriterionType } from '../enums/scoring-criterion-type.enum';
import { ScoreBandDto } from './score-band.dto';

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

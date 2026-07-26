import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ScoreEventKind } from '../enums/score-event-kind.enum';
import { DeductionType } from '../../regulations/enums/deduction-type.enum';

// Validação aqui é só de FORMATO — qual campo faz sentido pra cada
// `kind` (ex: SCORE_SET exige criterionId+value) é checado em
// ScoringService.submitEvents, que também confere se este jurado tem
// mesmo permissão pra aquele criterionId/dedução.
export class ScoreEventInputDto {
  @IsUUID()
  id: string;

  @IsUUID()
  scheduleEntryId: string;

  @IsEnum(ScoreEventKind)
  kind: ScoreEventKind;

  @IsOptional()
  @IsUUID()
  criterionId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsEnum(DeductionType)
  deductionType?: DeductionType;

  @IsOptional()
  @IsUUID()
  undoesEventId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  presentationElapsedMs?: number;

  @IsOptional()
  @IsString()
  text?: string;

  @IsDateString()
  clientCreatedAt: string;
}

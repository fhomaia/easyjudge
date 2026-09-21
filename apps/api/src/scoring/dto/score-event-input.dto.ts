import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ScoreEventKind } from '../enums/score-event-kind.enum';

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
  // Não valida contra a lista do regulamento de propósito: o jurado
  // envia deduções de um buffer offline com retry, e recusar um tipo
  // (ex. apagado depois de enfileirado) travaria o lote inteiro.
  // Tipo desconhecido é aceito e resolvido na leitura (valor 0).
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  deductionType?: string;

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

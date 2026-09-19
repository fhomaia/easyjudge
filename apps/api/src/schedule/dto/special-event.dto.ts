import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ScheduleEntryType } from '../enums/schedule-entry-type.enum';
import { SpecialEventAnchor } from '../enums/auto-generate-order.enum';

// Evento especial da geração automática (Almoço, Abertura, Premiação,
// Contestação de notas ou intervalo personalizado). `id` é gerado pelo
// cliente e só existe pra outros eventos poderem se referir a este
// (antes/depois de). Entra em todas as pistas e áreas de aquecimento.
export class SpecialEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @IsIn([
    ScheduleEntryType.BREAK,
    ScheduleEntryType.CEREMONY,
    ScheduleEntryType.AWARD,
  ])
  type: ScheduleEntryType.BREAK | ScheduleEntryType.CEREMONY | ScheduleEntryType.AWARD;

  @IsInt()
  @Min(1)
  @Max(720)
  durationMinutes: number;

  @IsEnum(SpecialEventAnchor)
  anchor: SpecialEventAnchor;

  // Só pro anchor `time`: minutos desde 00:00.
  @ValidateIf((e: SpecialEventDto) => e.anchor === SpecialEventAnchor.TIME)
  @IsInt()
  @Min(0)
  @Max(1439)
  timeMinutes?: number;

  // Só pra `before`/`after`: id de OUTRO evento especial da lista.
  @ValidateIf(
    (e: SpecialEventDto) =>
      e.anchor === SpecialEventAnchor.BEFORE ||
      e.anchor === SpecialEventAnchor.AFTER,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  refId?: string;
}

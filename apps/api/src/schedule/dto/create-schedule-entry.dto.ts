import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ScheduleEntryType } from '../enums/schedule-entry-type.enum';

// `type=warmup` não é aceito aqui — aquecimentos são criados
// automaticamente junto com a apresentação (ver ScheduleService.createEntry).
export class CreateScheduleEntryDto {
  @IsUUID()
  resourceId: string;

  @IsEnum(ScheduleEntryType)
  type: ScheduleEntryType;

  @IsInt()
  @Min(0)
  order: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

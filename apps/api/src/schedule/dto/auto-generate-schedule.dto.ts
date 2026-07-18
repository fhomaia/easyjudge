import { IsEnum, IsInt, Min } from 'class-validator';
import { ScheduleDistributionStrategy } from '../enums/schedule-distribution-strategy.enum';

export class AutoGenerateScheduleDto {
  @IsInt()
  @Min(0)
  startMinutes: number;

  @IsInt()
  @Min(0)
  lunchStartMinutes: number;

  @IsInt()
  @Min(0)
  lunchDurationMinutes: number;

  @IsInt()
  @Min(1)
  warmupMinutes: number;

  @IsEnum(ScheduleDistributionStrategy)
  distribution: ScheduleDistributionStrategy;
}

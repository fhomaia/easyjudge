import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateScheduleDayDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  startMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  endMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  defaultWarmupMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  defaultGapMinutes?: number;

  @IsOptional()
  @IsBoolean()
  ignoreUnscheduledPresentations?: boolean;
}

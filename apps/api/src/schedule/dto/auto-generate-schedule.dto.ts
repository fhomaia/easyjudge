import { IsInt, Min } from 'class-validator';

export class AutoGenerateScheduleDto {
  @IsInt()
  @Min(0)
  startMinutes: number;

  @IsInt()
  @Min(1)
  warmupMinutes: number;
}

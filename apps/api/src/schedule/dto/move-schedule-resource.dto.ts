import { IsInt, Min } from 'class-validator';

export class MoveScheduleResourceDto {
  @IsInt()
  @Min(0)
  order: number;
}

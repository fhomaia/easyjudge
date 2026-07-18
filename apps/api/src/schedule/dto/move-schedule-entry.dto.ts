import { IsInt, IsUUID, Min } from 'class-validator';

export class MoveScheduleEntryDto {
  @IsUUID()
  resourceId: string;

  @IsInt()
  @Min(0)
  order: number;
}

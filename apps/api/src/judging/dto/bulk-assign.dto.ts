import { IsEnum, IsUUID } from 'class-validator';

export enum BulkAssignStrategy {
  UNASSIGNED_ONLY = 'unassigned_only',
  REPLACE = 'replace',
  ADD = 'add',
}

export class BulkAssignDto {
  @IsUUID()
  judgeParticipationId: string;

  @IsEnum(BulkAssignStrategy)
  strategy: BulkAssignStrategy;
}

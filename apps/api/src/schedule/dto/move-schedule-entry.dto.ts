import { IsBoolean, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class MoveScheduleEntryDto {
  @IsUUID()
  resourceId: string;

  @IsInt()
  @Min(0)
  order: number;

  // Evento especial (Cronograma ao vivo, 2026-09-28): leva junto as cópias
  // das outras pistas e áreas de aquecimento (ver
  // ScheduleService.moveSpecialEventCopies). Só vale movendo dentro da
  // mesma pista. Sem isso (arraste do Setup) move uma cópia só.
  @IsOptional()
  @IsBoolean()
  moveCopies?: boolean;
}

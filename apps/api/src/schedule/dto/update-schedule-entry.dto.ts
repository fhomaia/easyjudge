import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

// Só se aplica a eventos especiais (break/ceremony/award criados manualmente
// ou pelo autoGenerate) — apresentação e aquecimento são bloqueados no
// service (ScheduleService.updateEntry), assim como o "Aguardando
// aquecimento"/"Aguardando disponibilidade da equipe" gerados automaticamente.
export class UpdateScheduleEntryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;
}

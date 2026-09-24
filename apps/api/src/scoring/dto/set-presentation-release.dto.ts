import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

// Nome do arquivo mantido (ver AdminScoringController). Liberação de
// notas/contestação/resultado por categoria em um dia (ver
// ReleasesService): sem `categoryId`, vale pra todas as categorias com
// apresentação no dia (a chave do dia).
export class SetPresentationReleaseDto {
  @IsUUID()
  dayId: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  scoresReleased?: boolean;

  @IsOptional()
  @IsBoolean()
  contestationReleased?: boolean;

  @IsOptional()
  @IsBoolean()
  resultsReleased?: boolean;
}

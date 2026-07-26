import { IsBoolean, IsOptional } from 'class-validator';

// Nome do arquivo mantido (ver AdminScoringController) — o conteúdo
// virou os 3 switches globais do evento (notas/contestação/resultado),
// não mais por apresentação.
export class SetPresentationReleaseDto {
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

import { Type } from 'class-transformer';
import { IsArray, IsUUID, ValidateNested } from 'class-validator';

export class AthleteEntryDto {
  @IsUUID()
  teamId: string;

  @IsUUID()
  categoryId: string;
}

// Lista COMPLETA de equipe+categoria do atleta (substitui a anterior).
export class SetAthleteEntriesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AthleteEntryDto)
  entries: AthleteEntryDto[];
}

// Lista COMPLETA de atletas de uma equipe numa categoria.
export class SetTeamCategoryAthletesDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  athleteIds: string[];
}

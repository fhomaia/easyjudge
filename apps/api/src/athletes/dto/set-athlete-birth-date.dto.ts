import { IsDateString, IsOptional } from 'class-validator';

export class SetAthleteBirthDateDto {
  // null apaga a data.
  @IsOptional()
  @IsDateString({ strict: true })
  birthDate?: string | null;
}

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SetRequirementValueDto {
  // Texto, opção da lista ou data (YYYY-MM-DD). Vazio/null apaga.
  @IsOptional()
  @IsString()
  @MaxLength(300)
  value?: string | null;
}

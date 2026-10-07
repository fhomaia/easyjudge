import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CROSS_PROGRAM_MODES, type CrossProgramMode } from '../crossover-rules';

// Substitui as regras inteiras (a tela sempre manda tudo).
export class UpdateCrossoverRulesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxTeams: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxCategories: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  maxTeamCheerCrossover: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxLevelDifference: number | null;

  @IsIn(CROSS_PROGRAM_MODES)
  crossProgram: CrossProgramMode;
}

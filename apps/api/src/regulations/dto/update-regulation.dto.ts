import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { RegulationDeductionMode } from '../enums/regulation-deduction-mode.enum';

export class UpdateRegulationDto {
  @IsOptional()
  @IsEnum(RegulationDeductionMode)
  deductionMode?: RegulationDeductionMode;

  // Validação fina (só aceitar chaves de DeductionType, valores
  // numéricos) fica no service — um objeto parcial e livre não tem um
  // decorator pronto do class-validator pra validar "cada valor é
  // number", então filtramos na mão em RegulationsService.
  @IsOptional()
  @IsObject()
  deductionValues?: Record<string, number>;
}

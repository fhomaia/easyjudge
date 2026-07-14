import { IsInt, IsUUID, Min, ValidateIf } from 'class-validator';

export class MoveScoringCriterionDto {
  // null = vira nó raiz. ValidateIf pula a validação de UUID quando o
  // valor é null (em vez de @IsOptional, que também aceitaria undefined
  // — aqui o campo é sempre obrigatório, só o valor pode ser null).
  @ValidateIf((dto) => dto.newParentId !== null)
  @IsUUID()
  newParentId: string | null;

  @IsInt()
  @Min(0)
  newIndex: number;
}

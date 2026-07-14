import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateScoringTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  targetScore?: number;

  // Quando informado, os critérios (árvore inteira) do template de
  // origem são copiados para o novo template recém-criado — ver
  // ScoringTemplatesService.cloneCriteria. Precisa ser um template do
  // próprio usuário.
  @IsOptional()
  @IsUUID()
  cloneFromId?: string;
}

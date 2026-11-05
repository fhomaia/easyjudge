import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AthleteEntryDto } from './set-athlete-entries.dto';

// Atleta acrescenta um programa à inscrição no evento, pelo email do
// programa (só o email, mesmo sem conta).
export class AddAthleteRequestProgramDto {
  @IsEmail()
  @MaxLength(255)
  email: string;
}

// Rascunho do pedido: categorias escolhidas (lista completa) e recado.
export class SaveAthleteRequestDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  categoryIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

// Aprovação pelo programa: equipe de cada categoria (lista completa; o
// programa pode mudar as categorias pedidas antes de aprovar).
export class ApproveAthleteRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AthleteEntryDto)
  entries: AthleteEntryDto[];
}

export class RequestAthleteChangesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}

export class RejectAthleteRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AthleteEntryDto } from './set-athlete-entries.dto';
import { RegistrationRequestType } from '../entities/registration-request.entity';

// Começar a inscrição (POST /events/:eventId/registration). Campos
// opcionais: sem eles usa o perfil do programa; com eles, corrige o
// perfil antes (conta antiga sem cidade/UF).
export class RegisterProgramDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  state?: string;
}

// Lista COMPLETA de categorias de uma equipe da inscrição.
export class SetRegistrationTeamCategoriesDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  categoryIds: string[];
}

// Lista COMPLETA de atletas (vínculos do elenco, AthleteLink) de uma
// equipe numa categoria.
export class SetRegistrationPairAthletesDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  linkIds: string[];
}

// Lista COMPLETA de equipe+categoria de um atleta do elenco no evento.
export class SetRegistrationAthleteEntriesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AthleteEntryDto)
  entries: AthleteEntryDto[];
}

// Pedido ao organizador depois de enviada a ficha.
export class CreateRegistrationRequestDto {
  @IsEnum(RegistrationRequestType)
  type: RegistrationRequestType;

  // Obrigatória pra alteração; no cancelamento é justificativa opcional.
  @ValidateIf((o: CreateRegistrationRequestDto) => o.type === RegistrationRequestType.CHANGE || !!o.message)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message?: string;
}

// Arrastar a equipe de uma categoria pra outra (atletas vão junto).
export class MoveTeamCategoryDto {
  @IsUUID()
  toCategoryId: string;
}

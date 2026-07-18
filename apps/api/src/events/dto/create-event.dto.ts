import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsDateString()
  startDate: string;

  // Não faz mais parte do formulário de criação (2026-07-16) — o
  // número de dias agora é controlado na tela de Cronograma ("+ Dia").
  // Opcional aqui, default 1 aplicado em EventsService.createEvent.
  @IsOptional()
  @IsInt()
  @Min(1)
  competitionDays?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  location: string;
}

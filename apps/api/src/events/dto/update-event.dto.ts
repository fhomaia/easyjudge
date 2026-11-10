import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { RegistrationStatus } from '../enums/registration-status.enum';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  competitionDays?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  venue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  // Sem data limite = null (ou ausente na criação).
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  registrationDeadline?: string | null;

  // Liberar/pausar as inscrições; não volta pra 'not_started'.
  @IsOptional()
  @IsIn([RegistrationStatus.OPEN, RegistrationStatus.PAUSED])
  registrationStatus?: RegistrationStatus;
}

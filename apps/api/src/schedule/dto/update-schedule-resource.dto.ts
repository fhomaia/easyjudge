import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateScheduleResourceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @IsOptional()
  @IsBoolean()
  supportsPresentations?: boolean;

  // null = desvincula o aquecimento (ValidateIf pula a validação de
  // UUID nesse caso); undefined = campo não enviado, não mexe.
  @IsOptional()
  @ValidateIf((dto) => dto.pairedResourceId !== null)
  @IsUUID()
  pairedResourceId?: string | null;
}

import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ScoreBandDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsNumber()
  min: number;

  @IsNumber()
  max: number;
}

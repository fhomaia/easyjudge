import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CategoryModality } from '../enums/category-modality.enum';
import { CategoryDivision } from '../enums/category-division.enum';
import { CategoryFormat } from '../enums/category-format.enum';
import { CategoryStatus } from '../enums/category-status.enum';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEnum(CategoryModality)
  modality?: CategoryModality;

  @IsOptional()
  @IsEnum(CategoryDivision)
  division?: CategoryDivision;

  @IsOptional()
  @IsEnum(CategoryFormat)
  categoryFormat?: CategoryFormat;

  @ValidateIf((dto) => dto.categoryFormat === CategoryFormat.CUSTOM)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customFormatLabel?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(7)
  level?: number;

  @IsOptional()
  @IsBoolean()
  nonTumbling?: boolean;

  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;
}

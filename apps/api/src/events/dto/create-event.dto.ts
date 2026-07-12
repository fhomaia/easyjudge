import {
  IsDateString,
  IsInt,
  IsNotEmpty,
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

  @IsInt()
  @Min(1)
  competitionDays: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  location: string;
}

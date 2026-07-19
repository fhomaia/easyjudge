import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { EventMemberRole } from '../enums/event-member-role.enum';

export class CreateEventStaffMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsEmail()
  email: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(EventMemberRole, { each: true })
  roles: EventMemberRole[];
}

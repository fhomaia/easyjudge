import { ArrayNotEmpty, IsArray, IsEnum } from 'class-validator';
import { EventMemberRole } from '../enums/event-member-role.enum';

export class UpdateEventStaffMemberDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(EventMemberRole, { each: true })
  roles: EventMemberRole[];
}

import { ArrayNotEmpty, IsUUID } from 'class-validator';

export class AddTeamCategoryDto {
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  categoryIds: string[];
}

import { IsUUID } from 'class-validator';

export class AddTeamCategoryDto {
  @IsUUID()
  categoryId: string;
}

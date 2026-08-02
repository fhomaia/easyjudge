import { IsUUID } from 'class-validator';

export class AddEventScoringTemplateDto {
  @IsUUID()
  templateId: string;
}

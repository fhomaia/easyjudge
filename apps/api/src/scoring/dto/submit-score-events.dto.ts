import { Type } from 'class-transformer';
import { ArrayMinSize, ValidateNested } from 'class-validator';
import { ScoreEventInputDto } from './score-event-input.dto';

export class SubmitScoreEventsDto {
  @ValidateNested({ each: true })
  @Type(() => ScoreEventInputDto)
  @ArrayMinSize(1)
  events: ScoreEventInputDto[];
}

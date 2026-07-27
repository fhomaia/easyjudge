import { IsNotEmpty, IsString } from 'class-validator';

export class JoinEventByCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

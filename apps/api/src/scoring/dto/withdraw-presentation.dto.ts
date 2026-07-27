import { IsBoolean, IsOptional } from 'class-validator';

// `removeFromSchedule` só tem efeito quando o chamador é admin/assessor
// — se um programa mandar `true`, ScoringService.withdrawPresentation
// ignora e força `false` (programa não decide isso, ver CLAUDE.md).
export class WithdrawPresentationDto {
  @IsOptional()
  @IsBoolean()
  removeFromSchedule?: boolean;
}

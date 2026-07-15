import { IsArray, IsUUID } from 'class-validator';

// Conjunto completo de jurados de um nó — usado tanto pra substituir
// os jurados de uma folha (PUT .../criteria/:id/judges) quanto os de
// uma função especial (PUT .../special-roles/:role), mesma forma e
// mesma validação nos dois casos.
export class SetJudgeIdsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  judgeIds: string[];
}

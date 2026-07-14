// Formato da categoria (Team Cheer, Group Stunt etc.) — importante
// porque as regras de segurança são definidas por formato. Nomeado
// "categoryFormat" (não "type"/"eventType") a pedido do usuário.
export enum CategoryFormat {
  TEAM_CHEER = 'team_cheer',
  GROUP_STUNT = 'group_stunt',
  COED = 'coed',
  PARTNER = 'partner',
  CUSTOM = 'custom',
}

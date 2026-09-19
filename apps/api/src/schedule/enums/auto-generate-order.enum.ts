import { CategoryFormat } from '../../categories/enums/category-format.enum';

// Qual critério manda primeiro na distribuição automática (o outro só
// desempata dentro do grupo do primeiro). Ver ScheduleService.autoGenerate.
export enum AutoGenerateOrderPrimary {
  LEVEL = 'level',
  FORMAT = 'format',
}

export enum AutoGenerateLevelDirection {
  ASC = 'asc',
  DESC = 'desc',
}

// Ordem de preferência padrão dos formatos (pedido do usuário,
// 2026-08-05): Team Cheer, Group Stunt, Coed/Elite Stunt, Partner Stunt
// e por último os demais formatos (Custom). Também é o default da
// coluna ScheduleDay.autoFormatOrder — dias já existentes seguem
// exatamente o comportamento anterior (formato primeiro, nível
// crescente). Também é o desempate de formatos que não aparecem na
// lista salva do dia (ver ScheduleService.autoGenerate).
export const DEFAULT_AUTO_FORMAT_ORDER: CategoryFormat[] = [
  CategoryFormat.TEAM_CHEER,
  CategoryFormat.GROUP_STUNT,
  CategoryFormat.COED,
  CategoryFormat.PARTNER,
  CategoryFormat.CUSTOM,
];

// Chave de ordenação de um formato na preferência do "gerar
// automaticamente": os formatos fixos usam o próprio valor do enum;
// cada formato Custom vale por NOME (`custom:<rótulo>`), já que cada
// rótulo é, na prática, um formato diferente pro produtor. O frontend
// usa a mesma regra (lib/autoFormatKey.ts) pra montar a lista.
export function autoFormatKey(
  format: CategoryFormat,
  customFormatLabel: string | null | undefined,
): string {
  const label = customFormatLabel?.trim();
  return format === CategoryFormat.CUSTOM && label
    ? `custom:${label}`
    : format;
}

// Onde um evento especial da geração automática entra na fila de cada
// pista (ver ScheduleService.autoGenerate / planSpecialEvents).
export enum SpecialEventAnchor {
  TIME = 'time',
  START = 'start',
  END = 'end',
  BEFORE = 'before',
  AFTER = 'after',
}

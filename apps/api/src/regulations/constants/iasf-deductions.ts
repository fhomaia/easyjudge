import { DeductionType } from '../enums/deduction-type.enum';

// Ordem de exibição fixa (não depende da ordem de chaves de um objeto).
export const DEDUCTION_TYPES_ORDER: DeductionType[] = [
  DeductionType.ATHLETE_FALL,
  DeductionType.MAJOR_ATHLETE_FALL,
  DeductionType.BUILDING_BOBBLE,
  DeductionType.BUILDING_FALL,
  DeductionType.MAJOR_BUILDING_FALL,
  DeductionType.LEGALITY_INFRACTIONS,
  DeductionType.SKILL_OUT_OF_LEVEL,
  DeductionType.TIME_LIMIT_VIOLATIONS,
  DeductionType.BOUNDARY_VIOLATIONS,
];

export const IASF_DEFAULT_DEDUCTIONS: Record<DeductionType, number> = {
  [DeductionType.ATHLETE_FALL]: -1.0,
  [DeductionType.MAJOR_ATHLETE_FALL]: -2.0,
  [DeductionType.BUILDING_BOBBLE]: -2.0,
  [DeductionType.BUILDING_FALL]: -3.0,
  [DeductionType.MAJOR_BUILDING_FALL]: -4.0,
  [DeductionType.LEGALITY_INFRACTIONS]: -4.0,
  [DeductionType.SKILL_OUT_OF_LEVEL]: -1.0,
  [DeductionType.TIME_LIMIT_VIOLATIONS]: -1.0,
  [DeductionType.BOUNDARY_VIOLATIONS]: -1.0,
};

// Nome exibido de cada tipo padrão (os tipos personalizados carregam o
// próprio nome, ver Regulation.customDeductions).
export const DEDUCTION_LABELS: Record<DeductionType, string> = {
  [DeductionType.ATHLETE_FALL]: 'Athlete Fall',
  [DeductionType.MAJOR_ATHLETE_FALL]: 'Major Athlete Fall',
  [DeductionType.BUILDING_BOBBLE]: 'Building Bobble',
  [DeductionType.BUILDING_FALL]: 'Building Fall',
  [DeductionType.MAJOR_BUILDING_FALL]: 'Major Building Fall',
  [DeductionType.LEGALITY_INFRACTIONS]: 'Legality Infractions',
  [DeductionType.SKILL_OUT_OF_LEVEL]: 'Skill Performed Out of Level',
  [DeductionType.TIME_LIMIT_VIOLATIONS]: 'Time Limit Violations',
  [DeductionType.BOUNDARY_VIOLATIONS]: 'Boundary Violations',
};

// Prefixo da chave de um tipo personalizado (custom_<uuid>) — nunca
// colide com os valores de DeductionType.
export const CUSTOM_DEDUCTION_PREFIX = 'custom_';

// Nome mostrado quando uma dedução já registrada aponta pra um tipo que
// não existe mais no regulamento.
export const UNKNOWN_DEDUCTION_LABEL = 'Dedução removida';

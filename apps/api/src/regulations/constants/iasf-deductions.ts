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

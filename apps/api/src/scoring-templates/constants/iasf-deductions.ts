import { DeductionType } from '../enums/deduction-type.enum';
import { TemplateDeduction } from '../entities/scoring-template.entity';

// Conteúdo inicial de todo template novo (do zero ou clonado) — ver
// ScoringTemplatesService.create. Editável/removível livremente depois
// de criado, sem distinção de origem (não existe mais "modo IASF vs
// Personalizado"). Ordem = ordem de exibição.
export const IASF_DEFAULT_DEDUCTIONS: TemplateDeduction[] = [
  { id: DeductionType.ATHLETE_FALL, label: 'Athlete Fall', value: -1.0, requiresCode: false },
  { id: DeductionType.MAJOR_ATHLETE_FALL, label: 'Major Athlete Fall', value: -2.0, requiresCode: false },
  { id: DeductionType.BUILDING_BOBBLE, label: 'Building Bobble', value: -2.0, requiresCode: false },
  { id: DeductionType.BUILDING_FALL, label: 'Building Fall', value: -3.0, requiresCode: false },
  { id: DeductionType.MAJOR_BUILDING_FALL, label: 'Major Building Fall', value: -4.0, requiresCode: false },
  // Única regra padrão que já nasce exigindo especificação — a única
  // com esse comportamento hoje, mas deixou de ser hardcoded: o usuário
  // pode marcar/desmarcar isso em QUALQUER regra (padrão ou
  // personalizada) na tela de Deduções do template.
  { id: DeductionType.LEGALITY_INFRACTIONS, label: 'Legality Infractions', value: -4.0, requiresCode: true },
  { id: DeductionType.SKILL_OUT_OF_LEVEL, label: 'Skill Performed Out of Level', value: -1.0, requiresCode: false },
  { id: DeductionType.TIME_LIMIT_VIOLATIONS, label: 'Time Limit Violations', value: -1.0, requiresCode: false },
  { id: DeductionType.BOUNDARY_VIOLATIONS, label: 'Boundary Violations', value: -1.0, requiresCode: false },
];

// Nome exibido dos 9 ids padrão, derivado da lista acima — usado só
// como fallback de último nível (ScoringService.deductionLabel) quando
// uma nota aponta pra um id padrão que já não está mais na lista de
// deduções do template (ex.: template mudou depois da nota lançada).
export const DEDUCTION_LABELS: Record<string, string> = Object.fromEntries(
  IASF_DEFAULT_DEDUCTIONS.map((d) => [d.id, d.label]),
);

// Prefixo da chave de uma regra criada pelo usuário (custom_<uuid>) —
// nunca colide com os 9 ids padrão da IASF.
export const CUSTOM_DEDUCTION_PREFIX = 'custom_';

// Nome mostrado quando uma dedução já registrada aponta pra um id que
// não existe mais na lista de deduções do template.
export const UNKNOWN_DEDUCTION_LABEL = 'Dedução removida';

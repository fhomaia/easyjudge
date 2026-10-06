import {
  OPTION_CRITERION_FIELDS,
  type OptionCriterionKey,
} from '../categories/category-criteria';
import type { Category } from '../categories/entities/category.entity';

// Dados e documentos pedidos aos atletas na inscrição (2026-10-06). O
// produtor escolhe quais das sugestões quer (e ajusta) e pode criar
// outras. Só de atletas, nunca do programa (decisão do usuário).
export type RequirementKind = 'document' | 'text' | 'select' | 'date';

export type RequirementPreset =
  | 'birth_date'
  | 'identity'
  | 'school_proof'
  | 'university_proof'
  | 'cpf'
  | 'phone'
  | 'emergency_contact';

export interface RegistrationRequirement {
  id: string;
  kind: RequirementKind;
  // Sugestão de onde veio (null = criada pelo produtor). Define o tipo e,
  // nos dados, a validação (CPF, telefone).
  preset: RequirementPreset | null;
  label: string;
  description: string | null;
  required: boolean;
  // Só em `select`.
  options: string[];
  // Categorias em que vale: null = todas; senão, por critério de divisão
  // (ex.: { institution: ['school'] }). A categoria precisa ter um dos
  // valores em cada critério listado.
  appliesTo: Partial<Record<OptionCriterionKey, string[]>> | null;
}

export interface RegistrationSettingsView {
  // O programa pode enviar a ficha sem todos os documentos obrigatórios
  // dos atletas (completa até o prazo). Só documentos: dados obrigatórios
  // sempre precisam estar preenchidos pra enviar (decisão do usuário,
  // 2026-10-06).
  allowSubmitWithoutDocuments: boolean;
  requirements: RegistrationRequirement[];
}

// Sugestões com validação/máscara própria (data, CPF, telefone): nome e
// tipo fixos, pra o que se pede bater com o que se valida (decisão do
// usuário, 2026-10-06). Orientação, obrigatório e categorias continuam
// editáveis.
export const LOCKED_LABEL_PRESETS: RequirementPreset[] = [
  'birth_date',
  'cpf',
  'phone',
];

// Sugestões (o produtor ativa as que quiser). Ordem = ordem na tela.
export const REQUIREMENT_PRESETS: Record<
  RequirementPreset,
  Omit<RegistrationRequirement, 'id'>
> = {
  // Já vem ativada em todo evento (pode sair; categoria com regra de idade
  // continua exigindo a data). Nome e email não são exigências: vêm do
  // cadastro do atleta, sempre (a tela mostra fixos no topo).
  birth_date: {
    kind: 'date',
    preset: 'birth_date',
    label: 'Data de nascimento',
    description: null,
    required: true,
    options: [],
    appliesTo: null,
  },
  identity: {
    kind: 'document',
    preset: 'identity',
    label: 'Documento de identidade',
    description: 'RG, CNH ou certidão de nascimento (frente e verso).',
    required: true,
    options: [],
    appliesTo: null,
  },
  school_proof: {
    kind: 'document',
    preset: 'school_proof',
    label: 'Comprovante de vínculo escolar',
    description: 'Declaração de matrícula ou carteirinha do ano atual.',
    required: true,
    options: [],
    appliesTo: { institution: ['school'] },
  },
  university_proof: {
    kind: 'document',
    preset: 'university_proof',
    label: 'Comprovante de vínculo universitário',
    description: 'Declaração de matrícula ou carteirinha do semestre atual.',
    required: true,
    options: [],
    appliesTo: { institution: ['university'] },
  },
  cpf: {
    kind: 'text',
    preset: 'cpf',
    label: 'CPF',
    description: null,
    required: true,
    options: [],
    appliesTo: null,
  },
  phone: {
    kind: 'text',
    preset: 'phone',
    label: 'Telefone',
    description: null,
    required: true,
    options: [],
    appliesTo: null,
  },
  emergency_contact: {
    kind: 'text',
    preset: 'emergency_contact',
    label: 'Contato de emergência',
    description: 'Nome e telefone de quem avisar em caso de emergência.',
    required: true,
    options: [],
    appliesTo: null,
  },
};

// Sem configuração salva: só a data de nascimento.
export function defaultRegistrationSettings(): RegistrationSettingsView {
  return {
    allowSubmitWithoutDocuments: false,
    requirements: [{ id: 'req_birth_date', ...REQUIREMENT_PRESETS.birth_date }],
  };
}

// O item vale pro atleta se alguma das categorias dele bate com o
// `appliesTo` (em cada critério listado, a categoria tem uma das opções).
export function requirementApplies(
  requirement: RegistrationRequirement,
  categories: Category[],
): boolean {
  const rule = requirement.appliesTo;
  if (!rule) return true;
  return categories.some((category) =>
    Object.entries(rule).every(([key, ids]) => {
      const value =
        category[OPTION_CRITERION_FIELDS[key as OptionCriterionKey]];
      return !!value && (ids ?? []).includes(value);
    }),
  );
}

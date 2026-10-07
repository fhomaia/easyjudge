// Regras de crossover do evento (2026-10-07): não existe regra oficial,
// cada produtor configura a sua. Tudo desligado por padrão, menos o
// crossover entre programas: um programa por vínculo institucional. A única regra
// fixa (atleta não compete contra si mesmo: duas vezes na mesma categoria,
// por duas equipes ou dois programas) não é configurável e vale sempre.
// O cálculo das pendências fica em programs/crossover.ts.
export interface CrossoverRules {
  // Equipes distintas por atleta no evento (null = sem limite).
  maxTeams: number | null;
  // Categorias distintas por atleta no evento (null = sem limite).
  maxCategories: number | null;
  // Crossover no Team Cheer: quantos atletas de uma categoria de Team
  // Cheer o programa pode reutilizar em outra categoria de Team Cheer do
  // mesmo gênero (ver teamCheerCrossoverLimit).
  maxTeamCheerCrossover: number | null;
  // Diferença máxima entre os níveis de construção das categorias do
  // atleta na mesma modalidade (4.2 conta como 4).
  maxLevelDifference: number | null;
  // Crossover entre programas:
  // - allowed: o atleta pode competir por vários programas;
  // - none: por um programa só;
  // - by_institution: um programa por vínculo institucional (o da
  //   categoria em que compete), com Escolar e Universitário
  //   contando como um só. Ex. usual: All Star + Escolar pode, dois All
  //   Star não, Escolar + Universitário não.
  crossProgram: CrossProgramMode;
}

export type CrossProgramMode = 'allowed' | 'none' | 'by_institution';
export const CROSS_PROGRAM_MODES: CrossProgramMode[] = [
  'allowed',
  'none',
  'by_institution',
];

export const DEFAULT_CROSSOVER_RULES: CrossoverRules = {
  maxTeams: null,
  maxCategories: null,
  maxTeamCheerCrossover: null,
  maxLevelDifference: null,
  crossProgram: 'by_institution',
};

// Valor gravado (pode ser de uma versão antiga, sem algum campo) com os
// padrões no que faltar.
export function normalizeCrossoverRules(
  value: Partial<CrossoverRules> | null | undefined,
): CrossoverRules {
  const v = value ?? {};
  return {
    maxTeams: v.maxTeams ?? null,
    maxCategories: v.maxCategories ?? null,
    maxTeamCheerCrossover: v.maxTeamCheerCrossover ?? null,
    maxLevelDifference: v.maxLevelDifference ?? null,
    crossProgram: CROSS_PROGRAM_MODES.includes(
      v.crossProgram as CrossProgramMode,
    )
      ? (v.crossProgram as CrossProgramMode)
      : DEFAULT_CROSSOVER_RULES.crossProgram,
  };
}

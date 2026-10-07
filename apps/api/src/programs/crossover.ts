import { CategoryFormat } from '../categories/enums/category-format.enum';
import { CategoryCriterionKey } from '../categories/enums/category-criterion-key.enum';
import type { CategoryCriterion } from '../categories/category-criteria';
import type { Category } from '../categories/entities/category.entity';
import type { CrossoverRules } from '../regulations/crossover-rules';
import type { RegistrationIssue } from './services/program-registration.service';

// Vínculos institucionais (opções padrão) que contam como um só no
// crossover entre programas por vínculo: o atleta não compete por uma
// escola e uma universidade ao mesmo tempo. Fixo da plataforma (decisão do
// usuário); opção criada pelo produtor é um vínculo à parte.
const SHARED_INSTITUTIONS = ['school', 'university'];

// Uma equipe+categoria de um atleta do evento, de qualquer programa.
export interface CrossoverEntry {
  programId: string;
  // Ficha enviada: desempata entradas com a mesma hora (linhas anteriores à
  // coluna created_at ficaram todas com a hora da migration).
  programSubmittedAt: Date | null;
  // Nome do programa, nas mensagens de conflito com outro programa.
  programName: string;
  teamId: string;
  teamName: string;
  categoryId: string;
  athleteId: string;
  name: string;
  email: string;
  cpf: string | null;
  createdAt: Date;
}

// Pendências de crossover (2026-10-07). A mesma pessoa em programas
// diferentes é reconhecida pelo email ou pelo CPF. As entradas de cada
// pessoa são vistas em ordem de inscrição: cada uma é conferida contra as
// anteriores, então quem inscreveu por último fica com a pendência
// (decisão do usuário), e uma ficha já enviada não ganha pendência por
// causa de outro programa que inscreveu depois.
// Regra fixa: a pessoa não compete contra si mesma (mesma categoria duas
// vezes). As outras vêm do produtor (ver CrossoverRules).
export function crossoverIssues(
  entries: CrossoverEntry[],
  categories: Map<string, Category>,
  criteria: CategoryCriterion[],
  rules: CrossoverRules,
): Map<string, RegistrationIssue[]> {
  const result = new Map<string, RegistrationIssue[]>();
  const push = (entry: CrossoverEntry, problem: string) => {
    const category = categories.get(entry.categoryId);
    const list = result.get(entry.programId) ?? [];
    list.push({
      kind: 'crossover',
      teamId: entry.teamId,
      categoryId: entry.categoryId,
      athleteId: entry.athleteId,
      linkId: null,
      requirementId: null,
      blocking: true,
      message: `${entry.name}, ${entry.teamName} em ${category?.name ?? 'categoria'}: ${problem}`,
    });
    result.set(entry.programId, list);
  };
  const optionLabel = (key: CategoryCriterionKey, id: string) =>
    criteria.find((c) => c.key === key)?.options.find((o) => o.id === id)
      ?.label ?? id;
  const institutionLabel = (id: string) =>
    optionLabel(CategoryCriterionKey.INSTITUTION, id);
  // "Faixa" do vínculo: os do grupo dividem uma só. Sem vínculo, não conta.
  const institutionLane = (id: string | null | undefined) =>
    !id ? null : SHARED_INSTITUTIONS.includes(id) ? 'shared' : id;
  // Modalidade: o formato, ou o nome no Custom (cada Custom é uma).
  const modalityKey = (category: Category) =>
    category.categoryFormat === CategoryFormat.CUSTOM
      ? `custom:${(category.customFormatLabel ?? '').trim().toLowerCase()}`
      : category.categoryFormat;
  const construction = (category: Category | undefined) =>
    category?.level != null ? Math.trunc(category.level) : null;

  for (const person of groupByPerson(entries)) {
    person.sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() ||
        (a.programSubmittedAt?.getTime() ?? Infinity) -
          (b.programSubmittedAt?.getTime() ?? Infinity) ||
        `${a.programId}${a.teamId}${a.categoryId}`.localeCompare(
          `${b.programId}${b.teamId}${b.categoryId}`,
        ),
    );
    // "Outro programa" é avisado uma vez por ficha.
    const crossProgramReported = new Set<string>();

    person.forEach((entry, i) => {
      const prior = person.slice(0, i);
      const category = categories.get(entry.categoryId);
      if (!category) return;
      const where = (p: CrossoverEntry) =>
        p.programId === entry.programId
          ? `pela equipe ${p.teamName}`
          : `pelo programa ${p.programName}`;

      // Já barrado pela regra entre programas (proibido ou mesmo vínculo):
      // a pendência de "mesma categoria" por outro programa seria repetida.
      const blockedAcrossPrograms = (p: CrossoverEntry) =>
        p.programId !== entry.programId &&
        (rules.crossProgram === 'none' ||
          (rules.crossProgram === 'by_institution' &&
            !!institutionLane(category.institution) &&
            institutionLane(categories.get(p.categoryId)?.institution) ===
              institutionLane(category.institution)));

      const same = prior.find((p) => p.categoryId === entry.categoryId);
      if (same && !blockedAcrossPrograms(same)) {
        push(
          entry,
          `já compete nesta categoria ${where(same)}. O atleta não pode competir contra ele mesmo.`,
        );
      }

      // Outro programa: proibido, ou só num vínculo institucional
      // diferente (Escolar e Universitário contam como um só).
      if (!crossProgramReported.has(entry.programId)) {
        const others = prior.filter((p) => p.programId !== entry.programId);
        let problem: string | null = null;
        if (rules.crossProgram === 'none' && others.length > 0) {
          problem = `já compete pelo programa ${others[0].programName}, e o evento não permite crossover entre programas.`;
        } else if (rules.crossProgram === 'by_institution') {
          const lane = institutionLane(category.institution);
          const clash = lane
            ? others.find(
                (p) =>
                  institutionLane(categories.get(p.categoryId)?.institution) ===
                  lane,
              )
            : undefined;
          if (clash) {
            const otherInstitution = categories.get(clash.categoryId)
              ?.institution as string;
            problem =
              otherInstitution === category.institution
                ? `já compete por outro programa ${institutionLabel(otherInstitution)}; o evento permite um programa por vínculo institucional.`
                : `já compete por outro programa ${institutionLabel(otherInstitution)}; ${SHARED_INSTITUTIONS.map(institutionLabel).join(' e ')} contam como um vínculo só.`;
          }
        }
        if (problem) {
          crossProgramReported.add(entry.programId);
          push(entry, problem);
        }
      }

      if (rules.maxTeams != null) {
        const teams = new Set(prior.map((p) => p.teamId));
        if (!teams.has(entry.teamId) && teams.size >= rules.maxTeams) {
          push(
            entry,
            `ultrapassou o limite de ${rules.maxTeams} ${rules.maxTeams === 1 ? 'equipe' : 'equipes'} por atleta.`,
          );
        }
      }

      if (rules.maxCategories != null) {
        const categoryIds = new Set(prior.map((p) => p.categoryId));
        if (
          !categoryIds.has(entry.categoryId) &&
          categoryIds.size >= rules.maxCategories
        ) {
          push(
            entry,
            `ultrapassou o limite de ${rules.maxCategories} ${rules.maxCategories === 1 ? 'categoria' : 'categorias'} por atleta.`,
          );
        }
      }

      // Diferença de nível só entre categorias da mesma modalidade.
      const level = construction(category);
      if (rules.maxLevelDifference != null && level != null) {
        const conflict = prior.find((p) => {
          const other = categories.get(p.categoryId);
          const otherLevel = construction(other);
          return (
            !!other &&
            modalityKey(other) === modalityKey(category) &&
            otherLevel != null &&
            Math.abs(otherLevel - level) > rules.maxLevelDifference!
          );
        });
        if (conflict) {
          const max = rules.maxLevelDifference;
          push(
            entry,
            `compete na categoria ${categories.get(conflict.categoryId)?.name}; ${
              max === 0
                ? 'o evento não permite níveis diferentes por modalidade.'
                : `o evento permite diferença de até ${max} ${max === 1 ? 'nível' : 'níveis'} por modalidade.`
            }`,
          );
        }
      }
    });
  }
  if (rules.maxTeamCheerCrossover != null) {
    teamCheerCrossoverLimit(
      entries,
      categories,
      rules.maxTeamCheerCrossover,
      push,
    );
  }
  return result;
}

// Crossover no Team Cheer: quantos atletas de uma categoria de Team Cheer o
// programa pode reutilizar em outra categoria de Team Cheer (ex.: Large
// Coed Senior 4 e Small Coed Senior 4, geralmente 2). Conferido par a par
// (equipe+categoria), só entre categorias do mesmo gênero. Passou do
// limite: pendência pros atletas reutilizados por último.
function teamCheerCrossoverLimit(
  entries: CrossoverEntry[],
  categories: Map<string, Category>,
  max: number,
  push: (entry: CrossoverEntry, problem: string) => void,
) {
  // Rotinas de Team Cheer por programa: equipe+categoria -> atleta -> entrada.
  const routines = new Map<string, Map<string, CrossoverEntry>>();
  for (const entry of entries) {
    if (
      categories.get(entry.categoryId)?.categoryFormat !==
      CategoryFormat.TEAM_CHEER
    ) {
      continue;
    }
    const key = `${entry.programId}|${entry.teamId}|${entry.categoryId}`;
    const athletes = routines.get(key) ?? new Map<string, CrossoverEntry>();
    athletes.set(entry.athleteId, entry);
    routines.set(key, athletes);
  }
  const list = [...routines.entries()];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const [keyA, athletesA] = list[i];
      const [keyB, athletesB] = list[j];
      if (keyA.split('|')[0] !== keyB.split('|')[0]) continue;
      const first = athletesA.values().next().value as CrossoverEntry;
      const second = athletesB.values().next().value as CrossoverEntry;
      if (
        categories.get(first.categoryId)?.gender !==
        categories.get(second.categoryId)?.gender
      ) {
        continue;
      }
      // Pra cada atleta nas duas: a entrada mais recente (reutilização).
      const shared = [...athletesA.keys()]
        .filter((id) => athletesB.has(id))
        .map((id) => {
          const a = athletesA.get(id)!;
          const b = athletesB.get(id)!;
          return a.createdAt.getTime() > b.createdAt.getTime()
            ? { later: a, other: b }
            : { later: b, other: a };
        })
        .sort(
          (x, y) => x.later.createdAt.getTime() - y.later.createdAt.getTime(),
        );
      for (const { later } of shared.slice(max)) {
        push(
          later,
          `O limite de atletas de crossover (${max}) foi ultrapassado.`,
        );
      }
    }
  }
}

// Junta as entradas da mesma pessoa: mesmo email ou mesmo CPF (em qualquer
// combinação, ex.: email igual num programa e CPF igual em outro).
function groupByPerson(entries: CrossoverEntry[]): CrossoverEntry[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(x, root);
    return root;
  };
  const add = (x: string) => {
    if (!parent.has(x)) parent.set(x, x);
  };
  for (const e of entries) {
    const email = `e:${e.email.trim().toLowerCase()}`;
    add(email);
    if (e.cpf) {
      const cpf = `c:${e.cpf}`;
      add(cpf);
      parent.set(find(cpf), find(email));
    }
  }
  const groups = new Map<string, CrossoverEntry[]>();
  for (const e of entries) {
    const root = find(`e:${e.email.trim().toLowerCase()}`);
    groups.set(root, [...(groups.get(root) ?? []), e]);
  }
  return [...groups.values()];
}

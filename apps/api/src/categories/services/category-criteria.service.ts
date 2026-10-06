import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import type {
  CategoryCriterionLabel,
  CategoryRules,
} from '../entities/category.entity';
import { CategoryCriteriaSettings } from '../entities/category-criteria-settings.entity';
import { CategoryCriterionKey } from '../enums/category-criterion-key.enum';
import { CategoryFormat } from '../enums/category-format.enum';
import {
  CRITERION_LABELS,
  CRITERION_ORDER,
  builtInOptionIds,
  OPTION_CRITERION_FIELDS,
  defaultCategoryCriteria,
  effectiveNonTumbling,
  isOptionCriterion,
  levelLabel,
  levelProblem,
  type CategoryCriterion,
  type CategoryCriterionOption,
} from '../category-criteria';
import {
  UpdateCategoryCriteriaDto,
  type CategoryCriterionOptionDto,
} from '../dto/update-category-criteria.dto';
import { EventsService } from '../../events/services/events.service';

// Campos que entram na comparação de "mesma categoria".
export type CategoryIdentity = Pick<
  Category,
  | 'categoryFormat'
  | 'customFormatLabel'
  | 'institution'
  | 'regime'
  | 'ageGroup'
  | 'gender'
  | 'size'
  | 'level'
  | 'nonTumbling'
>;

@Injectable()
export class CategoryCriteriaService {
  constructor(
    @InjectRepository(CategoryCriteriaSettings)
    private readonly settingsRepo: Repository<CategoryCriteriaSettings>,
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    private readonly eventsService: EventsService,
  ) {}

  async getForEvent(eventId: string): Promise<CategoryCriterion[]> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    return this.getByAlias(event.aliasId);
  }

  async getByAlias(aliasId: string): Promise<CategoryCriterion[]> {
    const row = await this.settingsRepo.findOneBy({ aliasId });
    const defaults = defaultCategoryCriteria();
    const event = await this.eventsService.findEventOrThrow(aliasId);
    // Sempre na ordem fixa; critério sem nada salvo (ou que a plataforma
    // ganhe depois) vem com as opções padrão.
    return CRITERION_ORDER.map((key) => {
      const saved = row?.criteria.find((c) => c.key === key);
      const criterion = saved ?? defaults.find((d) => d.key === key)!;
      if (key === CategoryCriterionKey.AGE_GROUP && !criterion.ageCutoffDate) {
        // Sem data escolhida, a idade é conferida no dia do evento.
        return this.withBuiltInFlag({
          ...criterion,
          ageCutoffDate: event.startDate,
        });
      }
      return this.withBuiltInFlag(criterion);
    });
  }

  async update(
    eventId: string,
    dto: UpdateCategoryCriteriaDto,
  ): Promise<CategoryCriterion[]> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const aliasId = event.aliasId;
    const previous = await this.getByAlias(aliasId);

    const keys = dto.criteria.map((c) => c.key);
    if (
      keys.length !== CRITERION_ORDER.length ||
      CRITERION_ORDER.some((k) => !keys.includes(k))
    ) {
      throw new BadRequestException(
        'Envie todos os critérios de divisão, cada um uma vez.',
      );
    }

    const next: CategoryCriterion[] = CRITERION_ORDER.map((key) => {
      const c = dto.criteria.find((item) => item.key === key)!;
      const before = previous.find((p) => p.key === key);
      return this.buildCriterion(
        key,
        c.options,
        c.ageCutoffDate ?? null,
        before,
      );
    });

    for (const criterion of next) {
      const kept = new Set(criterion.options.map((o) => o.id));
      if ([...builtInOptionIds(criterion.key)].some((id) => !kept.has(id))) {
        throw new BadRequestException(
          `${CRITERION_LABELS[criterion.key]}: as opções padrão não podem ser excluídas, só as criadas por você.`,
        );
      }
    }

    const categories = await this.categoriesRepo.find({ where: { aliasId } });
    this.assertRemovedOptionsUnused(previous, next, categories);

    const row =
      (await this.settingsRepo.findOneBy({ aliasId })) ??
      this.settingsRepo.create({ aliasId });
    row.criteria = next;
    await this.settingsRepo.save(row);
    return next.map((c) => this.withBuiltInFlag(c));
  }

  private withBuiltInFlag(criterion: CategoryCriterion): CategoryCriterion {
    const ids = builtInOptionIds(criterion.key);
    return {
      ...criterion,
      options: criterion.options.map((o) => ({ ...o, builtIn: ids.has(o.id) })),
    };
  }

  // Rótulos dos critérios que a categoria usa, na ordem fixa (ver
  // Category.criteriaLabels).
  attachLabels(categories: Category[], criteria: CategoryCriterion[]): void {
    for (const category of categories) {
      category.criteriaLabels = this.labelsFor(category, criteria);
      category.rules = this.rulesFor(category, criteria);
    }
  }

  // Regra efetiva (ver CategoryRules). `criteria` precisa vir de
  // getByAlias (data da Faixa etária já resolvida pra data do evento).
  rulesFor(category: Category, criteria: CategoryCriterion[]): CategoryRules {
    const options = (key: CategoryCriterionKey) =>
      criteria.find((c) => c.key === key);
    const sizeOption = category.size
      ? options(CategoryCriterionKey.SIZE)?.options.find(
          (o) => o.id === category.size,
        )
      : undefined;
    const ageCriterion = options(CategoryCriterionKey.AGE_GROUP);
    const ageOption = category.ageGroup
      ? ageCriterion?.options.find((o) => o.id === category.ageGroup)
      : undefined;
    const cutoff = ageCriterion?.ageCutoffDate ?? null;
    return {
      minAthletes: sizeOption
        ? (sizeOption.minAthletes ?? null)
        : category.minAthletes,
      maxAthletes: sizeOption
        ? (sizeOption.maxAthletes ?? null)
        : category.maxAthletes,
      minAge: ageOption ? (ageOption.minAge ?? null) : category.minAge,
      maxAge: ageOption ? (ageOption.maxAge ?? null) : category.maxAge,
      ageCutoffDate: ageOption ? cutoff : (category.ageCutoffDate ?? cutoff),
    };
  }

  async attachLabelsByAlias(
    categories: Category[],
    aliasId: string,
  ): Promise<void> {
    if (categories.length === 0) return;
    this.attachLabels(categories, await this.getByAlias(aliasId));
  }

  // Duas categorias são a mesma quando têm a mesma modalidade e o mesmo
  // valor em todos os critérios (não usar um critério também é um valor:
  // "Senior" e "sem faixa etária" são categorias diferentes).
  identityKey(category: CategoryIdentity): string {
    const parts: string[] = [category.categoryFormat];
    if (category.categoryFormat === CategoryFormat.CUSTOM) {
      parts.push((category.customFormatLabel ?? '').trim().toLowerCase());
    }
    for (const key of CRITERION_ORDER) {
      if (isOptionCriterion(key)) {
        parts.push(category[OPTION_CRITERION_FIELDS[key]] ?? '');
      } else {
        const nt = effectiveNonTumbling(
          category.categoryFormat,
          category.nonTumbling,
        );
        parts.push(`${category.level ?? ''}|${nt}`);
      }
    }
    return JSON.stringify(parts);
  }

  private labelsFor(
    category: Category,
    criteria: CategoryCriterion[],
  ): CategoryCriterionLabel[] {
    const labels: CategoryCriterionLabel[] = [];
    for (const criterion of criteria) {
      if (isOptionCriterion(criterion.key)) {
        const value = category[OPTION_CRITERION_FIELDS[criterion.key]];
        const option = criterion.options.find((o) => o.id === value);
        if (value && option) {
          labels.push({ key: criterion.key, value, label: option.label });
        }
      } else if (category.level != null) {
        const nonTumbling = effectiveNonTumbling(
          category.categoryFormat,
          category.nonTumbling,
        );
        labels.push({
          key: criterion.key,
          value: `${category.level}${nonTumbling ? '-nt' : ''}`,
          label: `Nível ${levelLabel(category.level, nonTumbling)}`,
        });
      }
    }
    return labels;
  }

  private buildCriterion(
    key: CategoryCriterionKey,
    options: CategoryCriterionOptionDto[],
    ageCutoffDate: string | null,
    before: CategoryCriterion | undefined,
  ): CategoryCriterion {
    const name = CRITERION_LABELS[key];
    if (key === CategoryCriterionKey.LEVEL) {
      return { key, options: this.buildLevelOptions(options) };
    }

    const knownIds = new Set(before?.options.map((o) => o.id) ?? []);
    const seenLabels = new Set<string>();
    const seenIds = new Set<string>();
    const built = options.map((o): CategoryCriterionOption => {
      const label = (o.label ?? '').trim();
      if (!label) {
        throw new BadRequestException(`${name}: toda opção precisa de nome.`);
      }
      const labelKey = label.toLowerCase();
      if (seenLabels.has(labelKey)) {
        throw new BadRequestException(
          `${name}: a opção "${label}" aparece mais de uma vez.`,
        );
      }
      seenLabels.add(labelKey);

      // Id que o servidor não conhece vira opção nova: o id é sempre
      // gerado aqui, nunca escolhido pelo navegador.
      const id =
        o.id && knownIds.has(o.id) && !seenIds.has(o.id)
          ? o.id
          : `opt_${randomUUID().slice(0, 8)}`;
      seenIds.add(id);

      const option: CategoryCriterionOption = { id, label };
      if (key === CategoryCriterionKey.AGE_GROUP) {
        option.minAge = o.minAge ?? null;
        option.maxAge = o.maxAge ?? null;
        if (
          option.minAge != null &&
          option.maxAge != null &&
          option.minAge > option.maxAge
        ) {
          throw new BadRequestException(
            `${name}: em "${label}", a idade mínima passa da máxima.`,
          );
        }
      }
      if (key === CategoryCriterionKey.SIZE) {
        option.minAthletes = o.minAthletes ?? null;
        option.maxAthletes = o.maxAthletes ?? null;
        if (
          option.minAthletes != null &&
          option.maxAthletes != null &&
          option.minAthletes > option.maxAthletes
        ) {
          throw new BadRequestException(
            `${name}: em "${label}", o mínimo de atletas passa do máximo.`,
          );
        }
      }
      return option;
    });

    const criterion: CategoryCriterion = { key, options: built };
    if (key === CategoryCriterionKey.AGE_GROUP) {
      // Sem data, vale a do evento (ver getByAlias).
      criterion.ageCutoffDate = ageCutoffDate;
    }
    return criterion;
  }

  // Paleta de níveis do evento: cada um válido (levelProblem) e sem
  // repetir. O rótulo e o id saem do próprio nível.
  private buildLevelOptions(
    options: CategoryCriterionOptionDto[],
  ): CategoryCriterionOption[] {
    const seen = new Set<string>();
    const built: CategoryCriterionOption[] = [];
    for (const o of options) {
      if (o.level == null) {
        throw new BadRequestException('Nível: informe o número do nível.');
      }
      const nonTumbling = o.nonTumbling ?? false;
      const problem = levelProblem(o.level, nonTumbling);
      if (problem)
        throw new BadRequestException(`Nível ${o.level}: ${problem}`);
      const id = `level_${String(o.level).replace('.', '_')}${nonTumbling ? '_nt' : ''}`;
      if (seen.has(id)) {
        throw new BadRequestException(
          `O nível ${levelLabel(o.level, nonTumbling)} aparece mais de uma vez.`,
        );
      }
      seen.add(id);
      built.push({
        id,
        label: levelLabel(o.level, nonTumbling),
        level: o.level,
        nonTumbling,
      });
    }
    return built.sort(
      (a, b) =>
        (a.level ?? 0) - (b.level ?? 0) ||
        Number(a.nonTumbling) - Number(b.nonTumbling),
    );
  }

  // Opção usada por alguma categoria não pode sumir (a categoria ficaria
  // apontando pra nada), mesmo com o critério desligado.
  private assertRemovedOptionsUnused(
    previous: CategoryCriterion[],
    next: CategoryCriterion[],
    categories: Category[],
  ): void {
    for (const before of previous) {
      if (!isOptionCriterion(before.key)) continue;
      const field = OPTION_CRITERION_FIELDS[before.key];
      const after = next.find((c) => c.key === before.key);
      const keptIds = new Set(after?.options.map((o) => o.id) ?? []);
      for (const option of before.options) {
        if (keptIds.has(option.id)) continue;
        const user = categories.find((c) => c[field] === option.id);
        if (user) {
          throw new ConflictException(
            `A opção "${option.label}" de ${CRITERION_LABELS[before.key]} está em uso na categoria "${user.name}". Mude a categoria antes de excluir a opção.`,
          );
        }
      }
    }
  }
}

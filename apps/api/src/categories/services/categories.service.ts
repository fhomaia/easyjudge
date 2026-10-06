import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import {
  CRITERION_LABELS,
  OPTION_CRITERION_FIELDS,
  isAlwaysNonTumbling,
  isOptionCriterion,
  levelProblem,
  sizeAllowedFor,
  type CategoryCriterion,
} from '../category-criteria';
import { CategoryCriterionKey } from '../enums/category-criterion-key.enum';
import {
  CategoryCriteriaService,
  type CategoryIdentity,
} from './category-criteria.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { EventsService } from '../../events/services/events.service';
import { EventActivityLogService } from '../../events/services/event-activity-log.service';
import { EventActivityAction } from '../../events/enums/event-activity-action.enum';
import { ScoringTemplatesService } from '../../scoring-templates/services/scoring-templates.service';
import { stripUndefined } from '../../common/utils/strip-undefined';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    private readonly eventsService: EventsService,
    private readonly scoringTemplatesService: ScoringTemplatesService,
    private readonly activityLogService: EventActivityLogService,
    private readonly criteriaService: CategoryCriteriaService,
  ) {}

  async create(
    eventId: string,
    dto: CreateCategoryDto,
    userId: string,
  ): Promise<Category> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    await this.scoringTemplatesService.assertUsableTemplate(
      dto.scoringTemplateId,
      userId,
    );
    const criteria = await this.criteriaService.getByAlias(event.aliasId);
    const category = this.categoriesRepo.create({
      name: dto.name,
      categoryFormat: dto.categoryFormat,
      customFormatLabel: dto.customFormatLabel ?? null,
      scoringTemplateId: dto.scoringTemplateId,
      presentationTimeSeconds: dto.presentationTimeSeconds,
      warmupMinutes: dto.warmupMinutes,
      institution: null,
      regime: null,
      ageGroup: null,
      gender: null,
      size: null,
      level: null,
      nonTumbling: false,
      minAthletes: dto.minAthletes ?? null,
      maxAthletes: dto.maxAthletes ?? null,
      minAge: dto.minAge ?? null,
      maxAge: dto.maxAge ?? null,
      ageCutoffDate: dto.ageCutoffDate ?? null,
      aliasId: event.aliasId,
    });
    this.applyCriteriaValues(category, dto, criteria);
    this.applyDirectRules(category);
    await this.assertNoDuplicateCategory(event.aliasId, category);
    const saved = await this.categoriesRepo.save(category);
    await this.activityLogService.record(
      event.aliasId,
      userId,
      EventActivityAction.CATEGORY_CREATED,
      saved.name,
    );
    return this.findCategoryWithTemplate(saved.id);
  }

  async findAllForEvent(eventId: string): Promise<Category[]> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const categories = await this.categoriesRepo.find({
      where: { aliasId: event.aliasId },
      relations: ['scoringTemplate'],
      order: { createdAt: 'DESC' },
    });
    await this.criteriaService.attachLabelsByAlias(categories, event.aliasId);
    return categories;
  }

  async update(
    eventId: string,
    id: string,
    dto: UpdateCategoryDto,
    userId: string,
  ): Promise<Category> {
    const category = await this.findCategoryOrThrow(eventId, id);
    if (dto.scoringTemplateId) {
      await this.scoringTemplatesService.assertUsableTemplate(
        dto.scoringTemplateId,
        userId,
      );
    }
    const {
      institution,
      regime,
      ageGroup,
      gender,
      size,
      level,
      nonTumbling,
      ...rest
    } = dto;
    Object.assign(category, stripUndefined(rest));
    const criteria = await this.criteriaService.getByAlias(category.aliasId);
    this.applyCriteriaValues(
      category,
      { institution, regime, ageGroup, gender, size, level, nonTumbling },
      criteria,
    );
    this.applyDirectRules(category);
    await this.assertNoDuplicateCategory(
      category.aliasId,
      category,
      category.id,
    );
    const saved = await this.categoriesRepo.save(category);
    await this.activityLogService.record(
      saved.aliasId,
      userId,
      EventActivityAction.CATEGORY_UPDATED,
      saved.name,
    );
    return this.findCategoryWithTemplate(saved.id);
  }

  async remove(eventId: string, id: string, userId: string): Promise<void> {
    const category = await this.findCategoryOrThrow(eventId, id);
    await this.categoriesRepo.remove(category);
    await this.activityLogService.record(
      category.aliasId,
      userId,
      EventActivityAction.CATEGORY_DELETED,
      category.name,
    );
  }

  private async findCategoryOrThrow(
    eventId: string,
    id: string,
  ): Promise<Category> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const category = await this.categoriesRepo.findOneBy({
      id,
      aliasId: event.aliasId,
    });
    if (!category) throw new NotFoundException('Categoria não encontrada');
    return category;
  }

  // Valores dos critérios de divisão (ver category-criteria.ts). Nível é
  // obrigatório; os demais, cada categoria usa se quiser (null = não
  // usa); valor
  // informado precisa ser uma opção do evento. Campo ausente no corpo =
  // mantém o valor atual (edição parcial).
  private applyCriteriaValues(
    category: Category,
    values: Partial<
      Pick<
        Category,
        | 'institution'
        | 'regime'
        | 'ageGroup'
        | 'gender'
        | 'size'
        | 'level'
        | 'nonTumbling'
      >
    >,
    criteria: CategoryCriterion[],
  ): void {
    for (const criterion of criteria) {
      const name = CRITERION_LABELS[criterion.key];

      if (!isOptionCriterion(criterion.key)) {
        if (values.level !== undefined) category.level = values.level;
        if (values.nonTumbling !== undefined) {
          category.nonTumbling = values.nonTumbling;
        }
        // Nível é obrigatório (como a modalidade).
        if (category.level == null) {
          throw new BadRequestException('Escolha o nível da categoria.');
        }
        if (isAlwaysNonTumbling(category.categoryFormat)) {
          category.nonTumbling = true;
        }
        const problem = levelProblem(category.level, category.nonTumbling);
        if (problem) throw new BadRequestException(problem);
        continue;
      }

      const field = OPTION_CRITERION_FIELDS[criterion.key];
      const incoming = values[field];
      if (incoming !== undefined) category[field] = incoming || null;

      // Tamanho só em modalidade de grupo.
      if (
        criterion.key === CategoryCriterionKey.SIZE &&
        !sizeAllowedFor(category.categoryFormat)
      ) {
        category.size = null;
        continue;
      }

      const value = category[field];
      if (value && !criterion.options.some((o) => o.id === value)) {
        throw new BadRequestException(
          `Opção inválida em ${name}. Recarregue a página e tente de novo.`,
        );
      }
    }
  }

  // Regra direta de atletas/idade: some quando a categoria usa a divisão
  // correspondente (a regra passa a ser a da opção).
  private applyDirectRules(category: Category): void {
    if (category.size) {
      category.minAthletes = null;
      category.maxAthletes = null;
    }
    if (category.ageGroup) {
      category.minAge = null;
      category.maxAge = null;
      category.ageCutoffDate = null;
    }
    if (
      category.minAthletes != null &&
      category.maxAthletes != null &&
      category.minAthletes > category.maxAthletes
    ) {
      throw new BadRequestException('O mínimo de atletas passa do máximo.');
    }
    if (
      category.minAge != null &&
      category.maxAge != null &&
      category.minAge > category.maxAge
    ) {
      throw new BadRequestException('A idade mínima passa da máxima.');
    }
  }

  // Cada combinação de modalidade e critérios é uma categoria;
  // não há constraint única no banco pra isso (os critérios mudam por
  // evento), checagem em application-level.
  private async assertNoDuplicateCategory(
    aliasId: string,
    candidate: CategoryIdentity,
    excludeId?: string,
  ): Promise<void> {
    const key = this.criteriaService.identityKey(candidate);
    const others = await this.categoriesRepo.find({ where: { aliasId } });
    const conflict = others.find(
      (other) =>
        other.id !== excludeId &&
        this.criteriaService.identityKey(other) === key,
    );
    if (conflict) {
      throw new ConflictException(
        `Já existe uma categoria com essa mesma combinação: "${conflict.name}".`,
      );
    }
  }

  // save() não hidrata relações (só a coluna scoringTemplateId) — sem
  // isso, o objeto retornado por create/update pra tela ficaria sem
  // scoringTemplate.name até um refresh (GET /categories já usa
  // relations: ['scoringTemplate'], ver findAllForEvent).
  private async findCategoryWithTemplate(id: string): Promise<Category> {
    const category = await this.categoriesRepo.findOne({
      where: { id },
      relations: ['scoringTemplate'],
    });
    if (!category) throw new NotFoundException('Categoria não encontrada');
    await this.criteriaService.attachLabelsByAlias(
      [category],
      category.aliasId,
    );
    return category;
  }
}

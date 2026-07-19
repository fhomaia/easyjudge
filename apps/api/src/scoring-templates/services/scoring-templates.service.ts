import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScoringTemplate } from '../entities/scoring-template.entity';
import { ScoringCriterion } from '../entities/scoring-criterion.entity';
import { ScoringCriterionType } from '../enums/scoring-criterion-type.enum';
import { CreateScoringTemplateDto } from '../dto/create-scoring-template.dto';
import { UpdateScoringTemplateDto } from '../dto/update-scoring-template.dto';
import { stripUndefined } from '../../common/utils/strip-undefined';
import { Category } from '../../categories/entities/category.entity';

@Injectable()
export class ScoringTemplatesService {
  constructor(
    @InjectRepository(ScoringTemplate)
    private readonly templatesRepo: Repository<ScoringTemplate>,
    @InjectRepository(ScoringCriterion)
    private readonly criteriaRepo: Repository<ScoringCriterion>,
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
  ) {}

  async create(
    dto: CreateScoringTemplateDto,
    createdById: string,
  ): Promise<ScoringTemplate> {
    const { cloneFromId, ...templateData } = dto;
    if (cloneFromId) {
      await this.findOwnTemplateOrThrow(cloneFromId, createdById);
    }

    const template = this.templatesRepo.create({
      ...templateData,
      createdById,
    });
    const saved = await this.templatesRepo.save(template);

    if (cloneFromId) {
      await this.cloneCriteria(cloneFromId, saved.id);
    }
    return saved;
  }

  // Copia a árvore de critérios inteira de um template pro outro,
  // remapeando parentId pros novos ids (não dá pra só trocar
  // templateId, cada critério precisa de um id próprio). Processa em
  // ordem topológica simples: só clona um nó depois que o pai dele já
  // foi clonado (ou se for raiz).
  private async cloneCriteria(
    sourceTemplateId: string,
    targetTemplateId: string,
  ): Promise<void> {
    const sourceCriteria = await this.criteriaRepo.find({
      where: { templateId: sourceTemplateId },
      order: { order: 'ASC' },
    });

    const idMap = new Map<string, string>();
    const remaining = [...sourceCriteria];

    while (remaining.length > 0) {
      const index = remaining.findIndex(
        (c) => c.parentId === null || idMap.has(c.parentId),
      );
      if (index === -1) break;

      const source = remaining.splice(index, 1)[0];
      const clone = this.criteriaRepo.create({
        templateId: targetTemplateId,
        parentId: source.parentId ? idMap.get(source.parentId)! : null,
        type: source.type,
        name: source.name,
        description: source.description,
        maxScore: source.maxScore,
        weight: source.weight,
        order: source.order,
        showInJudgingSheet: source.showInJudgingSheet,
        allowDecimalScoring: source.allowDecimalScoring,
        isRequired: source.isRequired,
      });
      const saved = await this.criteriaRepo.save(clone);
      idMap.set(source.id, saved.id);
    }
  }

  async findAllForUser(userId: string): Promise<ScoringTemplate[]> {
    const templates = await this.templatesRepo
      .createQueryBuilder('template')
      .loadRelationCountAndMap('template.criteriaCount', 'template.criteria')
      .where('template.createdById = :userId', { userId })
      .orderBy('template.updatedAt', 'DESC')
      .getMany();

    if (templates.length === 0) return templates;

    const templateIds = templates.map((t) => t.id);
    const sums = await this.criteriaRepo
      .createQueryBuilder('criterion')
      .select('criterion.templateId', 'templateId')
      .addSelect('SUM(criterion.maxScore)', 'distributedScore')
      .where('criterion.parentId IS NULL')
      .andWhere('criterion.templateId IN (:...templateIds)', { templateIds })
      .groupBy('criterion.templateId')
      .getRawMany<{ templateId: string; distributedScore: string }>();

    const distributedByTemplateId = new Map(
      sums.map((s) => [s.templateId, Number(s.distributedScore)]),
    );

    const allCriteria = await this.criteriaRepo.find({
      where: templateIds.map((templateId) => ({ templateId })),
    });
    const criteriaByTemplateId = new Map<string, ScoringCriterion[]>();
    for (const criterion of allCriteria) {
      const list = criteriaByTemplateId.get(criterion.templateId) ?? [];
      list.push(criterion);
      criteriaByTemplateId.set(criterion.templateId, list);
    }

    for (const template of templates) {
      const distributedScore = distributedByTemplateId.get(template.id) ?? 0;
      template.distributedScore = distributedScore;
      const criteria = criteriaByTemplateId.get(template.id) ?? [];
      template.isComplete =
        distributedScore === template.targetScore &&
        !this.hasEmptyGroup(criteria);
    }
    return templates;
  }

  findOneForUser(id: string, userId: string): Promise<ScoringTemplate> {
    return this.findOwnTemplateOrThrow(id, userId);
  }

  async update(
    id: string,
    dto: UpdateScoringTemplateDto,
    userId: string,
  ): Promise<ScoringTemplate> {
    const template = await this.findOwnTemplateOrThrow(id, userId);
    Object.assign(template, stripUndefined(dto));
    return this.templatesRepo.save(template);
  }

  async remove(id: string, userId: string): Promise<void> {
    const template = await this.findOwnTemplateOrThrow(id, userId);
    const inUseCount = await this.categoriesRepo.count({
      where: { scoringTemplateId: id },
    });
    if (inUseCount > 0) {
      throw new ConflictException(
        'Este sistema de pontuação está em uso por categorias e não pode ser excluído.',
      );
    }
    await this.templatesRepo.remove(template);
  }

  // Usado por ScoringCriteriaService pra validar dono antes de mexer
  // nos critérios de um template.
  async findOwnTemplateOrThrow(
    id: string,
    userId: string,
  ): Promise<ScoringTemplate> {
    const template = await this.templatesRepo.findOneBy({ id });
    if (!template) throw new NotFoundException('Template não encontrado');
    if (template.createdById !== userId) {
      throw new ForbiddenException('Você não tem acesso a este template');
    }
    return template;
  }

  // Só confere que o template existe, SEM checar dono — usado por
  // JudgingService (escala de arbitragem), onde a autorização de quem
  // pode ver/mexer já é garantida pelo EventMemberGuard (papel no
  // evento) + a checagem de "o template está em uso por uma categoria
  // deste evento" (ver JudgingService.assertTemplateUsableForEvent).
  // Ownership por createdById só faz sentido pra quem está EDITANDO o
  // template em si (o construtor, /scoring-templates/*), não pra quem
  // só está escalando jurados num evento que usa esse template.
  async findTemplateOrThrow(id: string): Promise<ScoringTemplate> {
    const template = await this.templatesRepo.findOneBy({ id });
    if (!template) throw new NotFoundException('Template não encontrado');
    return template;
  }

  async getDistributedScore(templateId: string): Promise<number> {
    const result = await this.criteriaRepo
      .createQueryBuilder('criterion')
      .select('COALESCE(SUM(criterion.maxScore), 0)', 'sum')
      .where('criterion.templateId = :templateId', { templateId })
      .andWhere('criterion.parentId IS NULL')
      .getRawOne<{ sum: string }>();
    return Number(result?.sum ?? 0);
  }

  // Usado por CategoriesService antes de atribuir um template a uma
  // categoria — só um template do próprio usuário e "completo" (soma
  // dos critérios-raiz == targetScore E nenhum grupo sem item de
  // avaliação descendente) pode ser usado.
  async assertUsableTemplate(
    templateId: string,
    userId: string,
  ): Promise<ScoringTemplate> {
    const template = await this.findOwnTemplateOrThrow(templateId, userId);
    const distributed = await this.getDistributedScore(templateId);
    if (distributed !== template.targetScore) {
      throw new ConflictException(
        'Este sistema de pontuação está incompleto — a soma dos critérios-raiz precisa bater com a meta de pontos antes de ser usado em uma categoria.',
      );
    }
    const criteria = await this.criteriaRepo.find({ where: { templateId } });
    if (this.hasEmptyGroup(criteria)) {
      throw new ConflictException(
        'Este sistema de pontuação está incompleto — todo grupo precisa ter ao menos um item de avaliação vinculado (em qualquer nível).',
      );
    }
    return template;
  }

  // Verdadeiro se algum grupo (em qualquer nível) não tem nenhum item
  // de avaliação (score_item) entre seus descendentes — considera toda
  // a subárvore, não só os filhos diretos.
  private hasEmptyGroup(criteria: ScoringCriterion[]): boolean {
    const childrenByParent = new Map<string, ScoringCriterion[]>();
    for (const criterion of criteria) {
      if (!criterion.parentId) continue;
      const list = childrenByParent.get(criterion.parentId) ?? [];
      list.push(criterion);
      childrenByParent.set(criterion.parentId, list);
    }

    const hasLeafDescendant = (nodeId: string): boolean =>
      (childrenByParent.get(nodeId) ?? []).some((child) =>
        child.type === ScoringCriterionType.SCORE_ITEM
          ? true
          : hasLeafDescendant(child.id),
      );

    return criteria.some(
      (c) => c.type === ScoringCriterionType.GROUP && !hasLeafDescendant(c.id),
    );
  }
}

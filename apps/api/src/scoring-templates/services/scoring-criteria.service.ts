import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ScoringCriterion } from '../entities/scoring-criterion.entity';
import { ScoringCriterionType } from '../enums/scoring-criterion-type.enum';
import { CreateScoringCriterionDto } from '../dto/create-scoring-criterion.dto';
import { UpdateScoringCriterionDto } from '../dto/update-scoring-criterion.dto';
import { MoveScoringCriterionDto } from '../dto/move-scoring-criterion.dto';
import { ScoringTemplatesService } from './scoring-templates.service';
import { stripUndefined } from '../../common/utils/strip-undefined';

@Injectable()
export class ScoringCriteriaService {
  constructor(
    @InjectRepository(ScoringCriterion)
    private readonly criteriaRepo: Repository<ScoringCriterion>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly templatesService: ScoringTemplatesService,
  ) {}

  async create(
    templateId: string,
    dto: CreateScoringCriterionDto,
    userId: string,
  ): Promise<ScoringCriterion> {
    await this.templatesService.findOwnTemplateOrThrow(templateId, userId);

    const parentId = dto.parentId ?? null;
    if (parentId) {
      await this.promoteToGroupIfNeeded(templateId, parentId);
    }

    const order = await this.nextOrder(templateId, parentId);
    const criterion = this.criteriaRepo.create({
      ...dto,
      parentId,
      templateId,
      order,
    });
    return this.criteriaRepo.save(criterion);
  }

  async findAllForTemplate(
    templateId: string,
    userId: string,
  ): Promise<ScoringCriterion[]> {
    await this.templatesService.findOwnTemplateOrThrow(templateId, userId);
    return this.criteriaRepo.find({
      where: { templateId },
      order: { order: 'ASC' },
    });
  }

  // Variante sem checagem de dono — usada por JudgingService (ver
  // ScoringTemplatesService.findTemplateOrThrow pro raciocínio
  // completo: quem pode ver a escala de um evento não é
  // necessariamente quem criou o template).
  async findAllForTemplateUnchecked(
    templateId: string,
  ): Promise<ScoringCriterion[]> {
    await this.templatesService.findTemplateOrThrow(templateId);
    return this.criteriaRepo.find({
      where: { templateId },
      order: { order: 'ASC' },
    });
  }

  async update(
    templateId: string,
    id: string,
    dto: UpdateScoringCriterionDto,
    userId: string,
  ): Promise<ScoringCriterion> {
    await this.templatesService.findOwnTemplateOrThrow(templateId, userId);
    const criterion = await this.findCriterionOrThrow(templateId, id);

    if (
      dto.type === ScoringCriterionType.SCORE_ITEM &&
      criterion.type === ScoringCriterionType.GROUP
    ) {
      const childCount = await this.criteriaRepo.countBy({ parentId: id });
      if (childCount > 0) {
        throw new ConflictException(
          'Não é possível transformar em "Item de avaliação" um critério que já tem filhos.',
        );
      }
    }

    Object.assign(criterion, stripUndefined(dto));
    return this.criteriaRepo.save(criterion);
  }

  async remove(templateId: string, id: string, userId: string): Promise<void> {
    await this.templatesService.findOwnTemplateOrThrow(templateId, userId);
    const criterion = await this.findCriterionOrThrow(templateId, id);
    await this.criteriaRepo.remove(criterion);
  }

  // Reordena e/ou reparenta um nó dentro de uma transação. Retorna a
  // lista plana inteira do template já atualizada — contrato simples
  // pro frontend resincronizar sem precisar de merge parcial.
  async move(
    templateId: string,
    id: string,
    dto: MoveScoringCriterionDto,
    userId: string,
  ): Promise<ScoringCriterion[]> {
    await this.templatesService.findOwnTemplateOrThrow(templateId, userId);
    const criterion = await this.findCriterionOrThrow(templateId, id);

    const newParentId = dto.newParentId ?? null;

    if (newParentId) {
      if (newParentId === id) {
        throw new ConflictException(
          'Um critério não pode ser filho de si mesmo.',
        );
      }
      // Sobe a cadeia de ancestrais do novo pai — se o próprio nó
      // movido aparecer nela, o novo pai é descendente dele (cria um
      // ciclo).
      let currentId: string | null = newParentId;
      while (currentId) {
        const current = await this.findCriterionOrThrow(templateId, currentId);
        if (current.parentId === id) {
          throw new ConflictException(
            'Não é possível mover um critério para dentro de um de seus próprios descendentes.',
          );
        }
        currentId = current.parentId;
      }
    }

    const oldParentId = criterion.parentId;

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.withRepository(this.criteriaRepo);

      if (newParentId) {
        await this.promoteToGroupIfNeeded(templateId, newParentId, repo);
      }

      criterion.parentId = newParentId;
      criterion.order = dto.newIndex;
      await repo.save(criterion);

      await this.renumberSiblings(templateId, newParentId, id, repo);
      if (oldParentId !== newParentId) {
        await this.renumberSiblings(templateId, oldParentId, null, repo);
      }
    });

    return this.findAllForTemplate(templateId, userId);
  }

  private async promoteToGroupIfNeeded(
    templateId: string,
    parentId: string,
    repo: Repository<ScoringCriterion> = this.criteriaRepo,
  ): Promise<void> {
    const parent = await repo.findOneBy({ id: parentId, templateId });
    if (!parent) throw new NotFoundException('Critério não encontrado');
    if (parent.type === ScoringCriterionType.SCORE_ITEM) {
      parent.type = ScoringCriterionType.GROUP;
      await repo.save(parent);
    }
  }

  private async nextOrder(
    templateId: string,
    parentId: string | null,
  ): Promise<number> {
    const siblings = await this.criteriaRepo.find({
      where: { templateId, parentId: parentId ?? IsNull() },
    });
    if (siblings.length === 0) return 0;
    return Math.max(...siblings.map((s) => s.order)) + 1;
  }

  // Renumera os irmãos de `parentId` sequencialmente (0..n-1). Se
  // `movedId` fizer parte deste grupo, ele é reposicionado no índice já
  // atribuído a ele (criterion.order) antes de renumerar os demais.
  private async renumberSiblings(
    templateId: string,
    parentId: string | null,
    movedId: string | null,
    repo: Repository<ScoringCriterion> = this.criteriaRepo,
  ): Promise<void> {
    const siblings = await repo.find({
      where: { templateId, parentId: parentId ?? IsNull() },
      order: { order: 'ASC' },
    });

    const ordered = siblings;
    const movedIndex = movedId
      ? ordered.findIndex((c) => c.id === movedId)
      : -1;
    if (movedIndex !== -1) {
      const [moved] = ordered.splice(movedIndex, 1);
      const targetIndex = Math.min(Math.max(moved.order, 0), ordered.length);
      ordered.splice(targetIndex, 0, moved);
    }

    await Promise.all(
      ordered.map((c, index) => {
        if (c.order === index) return Promise.resolve(c);
        c.order = index;
        return repo.save(c);
      }),
    );
  }

  private async findCriterionOrThrow(
    templateId: string,
    id: string,
  ): Promise<ScoringCriterion> {
    const criterion = await this.criteriaRepo.findOneBy({ id, templateId });
    if (!criterion) throw new NotFoundException('Critério não encontrado');
    return criterion;
  }
}

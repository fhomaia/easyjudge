import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { CategoryFormat } from '../enums/category-format.enum';
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
    await this.assertNoDuplicateCategory(event.aliasId, {
      modality: dto.modality,
      division: dto.division,
      categoryFormat: dto.categoryFormat,
      customFormatLabel: dto.customFormatLabel ?? null,
      level: dto.level,
      nonTumbling: dto.nonTumbling ?? false,
    });
    const category = this.categoriesRepo.create({
      ...dto,
      aliasId: event.aliasId,
    });
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
    return this.categoriesRepo.find({
      where: { aliasId: event.aliasId },
      relations: ['scoringTemplate'],
      order: { createdAt: 'DESC' },
    });
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
    Object.assign(category, stripUndefined(dto));
    await this.assertNoDuplicateCategory(
      category.aliasId,
      {
        modality: category.modality,
        division: category.division,
        categoryFormat: category.categoryFormat,
        customFormatLabel: category.customFormatLabel ?? null,
        level: category.level,
        nonTumbling: category.nonTumbling,
      },
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

  // Modalidade + formato + divisão + nível (+ non-tumbling, quando o
  // formato permite variar) definem a "mesma" categoria pro domínio —
  // não há constraint única no banco pra isso, checagem em
  // application-level segue o mesmo padrão de
  // ProgramsService.assertEmailNotDuplicateInCatalog.
  private async assertNoDuplicateCategory(
    aliasId: string,
    values: Pick<
      Category,
      | 'modality'
      | 'division'
      | 'categoryFormat'
      | 'customFormatLabel'
      | 'level'
      | 'nonTumbling'
    >,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.categoriesRepo
      .createQueryBuilder('category')
      .where('category.aliasId = :aliasId', { aliasId })
      .andWhere('category.modality = :modality', { modality: values.modality })
      .andWhere('category.division = :division', { division: values.division })
      .andWhere('category.categoryFormat = :categoryFormat', {
        categoryFormat: values.categoryFormat,
      })
      .andWhere('category.level = :level', { level: values.level })
      .andWhere('category.nonTumbling = :nonTumbling', {
        nonTumbling: values.nonTumbling,
      });

    if (values.categoryFormat === CategoryFormat.CUSTOM) {
      qb.andWhere('LOWER(category.customFormatLabel) = LOWER(:customFormatLabel)', {
        customFormatLabel: values.customFormatLabel ?? '',
      });
    }

    if (excludeId) {
      qb.andWhere('category.id != :excludeId', { excludeId });
    }

    const conflict = await qb.getOne();
    if (conflict) {
      throw new ConflictException(
        'Já existe uma categoria com essa combinação de modalidade, formato, divisão e nível.',
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
    return category;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { EventsService } from '../../events/services/events.service';
import { ScoringTemplatesService } from '../../scoring-templates/services/scoring-templates.service';
import { stripUndefined } from '../../common/utils/strip-undefined';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    private readonly eventsService: EventsService,
    private readonly scoringTemplatesService: ScoringTemplatesService,
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
    const category = this.categoriesRepo.create({
      ...dto,
      aliasId: event.aliasId,
    });
    const saved = await this.categoriesRepo.save(category);
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
    const saved = await this.categoriesRepo.save(category);
    return this.findCategoryWithTemplate(saved.id);
  }

  async remove(eventId: string, id: string): Promise<void> {
    const category = await this.findCategoryOrThrow(eventId, id);
    await this.categoriesRepo.remove(category);
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

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { EventsService } from '../../events/services/events.service';
import { stripUndefined } from '../../common/utils/strip-undefined';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    private readonly eventsService: EventsService,
  ) {}

  async create(eventId: string, dto: CreateCategoryDto) {
    await this.eventsService.findEventOrThrow(eventId);
    const category = this.categoriesRepo.create({ ...dto, eventId });
    return this.categoriesRepo.save(category);
  }

  async findAllForEvent(eventId: string): Promise<Category[]> {
    await this.eventsService.findEventOrThrow(eventId);
    return this.categoriesRepo.find({
      where: { eventId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    eventId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findCategoryOrThrow(eventId, id);
    Object.assign(category, stripUndefined(dto));
    return this.categoriesRepo.save(category);
  }

  async remove(eventId: string, id: string): Promise<void> {
    const category = await this.findCategoryOrThrow(eventId, id);
    await this.categoriesRepo.remove(category);
  }

  private async findCategoryOrThrow(
    eventId: string,
    id: string,
  ): Promise<Category> {
    const category = await this.categoriesRepo.findOneBy({ id, eventId });
    if (!category) throw new NotFoundException('Categoria não encontrada');
    return category;
  }
}

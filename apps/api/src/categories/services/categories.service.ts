import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { EventsService } from '../../events/services/events.service';

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
}

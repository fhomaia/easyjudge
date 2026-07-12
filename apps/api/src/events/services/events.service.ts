import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../entities/event.entity';
import { CreateEventDto } from '../dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
  ) {}

  createEvent(dto: CreateEventDto, createdById: string) {
    const event = this.eventsRepo.create({ ...dto, createdById });
    return this.eventsRepo.save(event);
  }

  findAll() {
    return this.eventsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventsRepo.findOne({
      where: { id },
      relations: ['categories', 'teams'],
    });
    if (!event) throw new NotFoundException('Evento não encontrado');
    return event;
  }

  async setEventLogo(id: string, file: Express.Multer.File) {
    const event = await this.findEventOrThrow(id);
    event.logoUrl = `/uploads/logos/${file.filename}`;
    return this.eventsRepo.save(event);
  }

  // Usado por CategoriesService e TeamsService para validar que o evento
  // existe antes de criar um recurso vinculado a ele.
  async findEventOrThrow(id: string): Promise<Event> {
    const event = await this.eventsRepo.findOneBy({ id });
    if (!event) throw new NotFoundException('Evento não encontrado');
    return event;
  }
}

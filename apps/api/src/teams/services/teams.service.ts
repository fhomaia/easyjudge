import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../entities/team.entity';
import { CreateTeamDto } from '../dto/create-team.dto';
import { EventsService } from '../../events/services/events.service';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamsRepo: Repository<Team>,
    private readonly eventsService: EventsService,
  ) {}

  async create(eventId: string, dto: CreateTeamDto) {
    await this.eventsService.findEventOrThrow(eventId);
    const team = this.teamsRepo.create({ ...dto, eventId });
    return this.teamsRepo.save(team);
  }

  async setLogo(eventId: string, teamId: string, file: Express.Multer.File) {
    const team = await this.teamsRepo.findOneBy({ id: teamId, eventId });
    if (!team) throw new NotFoundException('Equipe não encontrada');
    team.logoUrl = `/uploads/logos/${file.filename}`;
    return this.teamsRepo.save(team);
  }
}

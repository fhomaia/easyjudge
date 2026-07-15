import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../entities/team.entity';
import { Category } from '../../categories/entities/category.entity';
import { CreateTeamDto } from '../dto/create-team.dto';
import { UpdateTeamDto } from '../dto/update-team.dto';
import { ProgramsService } from '../../programs/services/programs.service';
import { stripUndefined } from '../../common/utils/strip-undefined';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamsRepo: Repository<Team>,
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    private readonly programsService: ProgramsService,
  ) {}

  async create(
    eventId: string,
    programId: string,
    dto: CreateTeamDto,
  ): Promise<Team> {
    await this.programsService.findProgramOrThrow(eventId, programId);
    const team = this.teamsRepo.create({ programId, name: dto.name });
    return this.teamsRepo.save(team);
  }

  async findAllForProgram(eventId: string, programId: string): Promise<Team[]> {
    await this.programsService.findProgramOrThrow(eventId, programId);
    return this.teamsRepo.find({
      where: { programId },
      relations: ['categories'],
      order: { createdAt: 'ASC' },
    });
  }

  async update(
    eventId: string,
    programId: string,
    teamId: string,
    dto: UpdateTeamDto,
  ): Promise<Team> {
    const team = await this.findTeamOrThrow(eventId, programId, teamId);
    Object.assign(team, stripUndefined(dto));
    return this.teamsRepo.save(team);
  }

  async remove(eventId: string, programId: string, teamId: string): Promise<void> {
    const team = await this.findTeamOrThrow(eventId, programId, teamId);
    await this.teamsRepo.remove(team);
  }

  async addCategory(
    eventId: string,
    programId: string,
    teamId: string,
    categoryId: string,
  ): Promise<Team> {
    await this.findTeamOrThrow(eventId, programId, teamId);
    const category = await this.categoriesRepo.findOneBy({
      id: categoryId,
      eventId,
    });
    if (!category) throw new NotFoundException('Categoria não encontrada');

    await this.teamsRepo
      .createQueryBuilder()
      .relation(Team, 'categories')
      .of(teamId)
      .add(categoryId);

    return this.findTeamWithCategories(teamId);
  }

  async removeCategory(
    eventId: string,
    programId: string,
    teamId: string,
    categoryId: string,
  ): Promise<Team> {
    await this.findTeamOrThrow(eventId, programId, teamId);

    await this.teamsRepo
      .createQueryBuilder()
      .relation(Team, 'categories')
      .of(teamId)
      .remove(categoryId);

    return this.findTeamWithCategories(teamId);
  }

  private async findTeamOrThrow(
    eventId: string,
    programId: string,
    teamId: string,
  ): Promise<Team> {
    await this.programsService.findProgramOrThrow(eventId, programId);
    const team = await this.teamsRepo.findOneBy({ id: teamId, programId });
    if (!team) throw new NotFoundException('Equipe não encontrada');
    return team;
  }

  private async findTeamWithCategories(teamId: string): Promise<Team> {
    const team = await this.teamsRepo.findOne({
      where: { id: teamId },
      relations: ['categories'],
    });
    if (!team) throw new NotFoundException('Equipe não encontrada');
    return team;
  }
}

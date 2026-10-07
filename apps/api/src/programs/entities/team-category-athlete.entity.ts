import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Team } from '../../teams/entities/team.entity';
import { Category } from '../../categories/entities/category.entity';
import { ProgramAthlete } from './program-athlete.entity';

// Atleta marcado pra competir numa categoria por uma equipe (o par
// equipe+categoria é uma linha de team_categories). Opcional: categoria
// sem atleta marcado funciona como sempre funcionou. As FKs apagam
// sozinhas ao excluir equipe/categoria/atleta; tirar a categoria da
// equipe (team_categories) não apaga nenhum dos três, por isso
// TeamsService.removeCategory limpa estas linhas na mão.
@Entity('team_category_athletes')
export class TeamCategoryAthlete {
  @PrimaryColumn({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @PrimaryColumn({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @Index()
  @PrimaryColumn({ name: 'athlete_id', type: 'uuid' })
  athleteId: string;

  // Quando o atleta entrou nesta equipe+categoria: num conflito de
  // crossover, a pendência fica com quem inscreveu por último. Por isso
  // as trocas de lista só apagam/inserem o que mudou.
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @ManyToOne(() => ProgramAthlete, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'athlete_id' })
  athlete: ProgramAthlete;
}

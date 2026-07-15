import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { ProgramParticipation } from '../../programs/entities/program-participation.entity';
import { Category } from '../../categories/entities/category.entity';

// Equipe dentro de um programa — só nome, vinculada a uma ou mais
// categorias do mesmo evento (ver TeamsService.addCategory). Domínio
// novo (2026-07-14); o antigo "Team" (nome/email/cidade/estado) virou
// Program, depois renomeado pra ProgramParticipation (2026-07-15,
// para não ficar ambíguo ao lado de ProgramProfile) — ver
// apps/api/src/programs/.
@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'program_id' })
  programId: string;

  @ManyToOne(() => ProgramParticipation, (participation) => participation.teams, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'program_id' })
  program: ProgramParticipation;

  @Column({ length: 150 })
  name: string;

  // N:N nativa do TypeORM — adicionar/remover usa
  // `teamsRepo.createQueryBuilder().relation(Team, 'categories').of(id)
  // .add/.remove(categoryId)` (ver TeamsService), não precisa carregar
  // o array inteiro nem de uma entidade própria pra tabela de junção.
  @ManyToMany(() => Category)
  @JoinTable({
    name: 'team_categories',
    joinColumn: { name: 'team_id' },
    inverseJoinColumn: { name: 'category_id' },
  })
  categories: Category[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

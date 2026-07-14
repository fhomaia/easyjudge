import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ScoringCriterion } from './scoring-criterion.entity';

// Template de pontuação reutilizável entre eventos (não pertence a um
// evento específico — é uma biblioteca pessoal do usuário, atribuída a
// categorias depois, em uma etapa futura). Ver CLAUDE.md.
@Entity('scoring_templates')
export class ScoringTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Meta de pontos do template inteiro — a soma dos critérios-raiz
  // (maxScore) é validada contra este valor na tela de construção.
  @Column({ name: 'target_score', type: 'float', default: 100 })
  targetScore: number;

  @Index()
  @Column({ name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @OneToMany(() => ScoringCriterion, (criterion) => criterion.template)
  criteria: ScoringCriterion[];

  // Não é coluna — preenchida via loadRelationCountAndMap em
  // ScoringTemplatesService.findAllForUser, só para a listagem.
  criteriaCount?: number;

  // Não é coluna — soma do maxScore dos critérios-raiz, preenchida em
  // ScoringTemplatesService.findAllForUser, só para a listagem (permite
  // mostrar "completo"/"incompleto" sem buscar a árvore inteira).
  distributedScore?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

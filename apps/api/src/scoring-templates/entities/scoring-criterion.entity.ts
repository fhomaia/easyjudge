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
import { ScoringTemplate } from './scoring-template.entity';
import { ScoringCriterionType } from '../enums/scoring-criterion-type.enum';

// Faixa de pontuação opcional dentro de um item de avaliação (ex.:
// "Excelente" 18-20, "Bom" 14-18, ...) — só efeito visual na tela do
// jurado (ainda não implementado, ver CLAUDE.md), por isso não é uma
// entidade própria: é uma lista pequena e contida, editada junto com o
// resto do critério, sem necessidade de reordenar/mover como os
// próprios critérios têm.
export interface ScoreBand {
  name: string;
  description: string | null;
  color: string;
  min: number;
  max: number;
}

// Nó da árvore de critérios de um template — pode ser um Grupo (tem
// filhos) ou um Item de avaliação (nota, folha). Auto-referenciado via
// parentId (lista de adjacência); null = nó raiz. Todo nó (grupo ou
// item) tem um id próprio e estável desde já, mesmo sem a etapa futura
// de designação de jurados por nó existir ainda — ver CLAUDE.md.
@Entity('scoring_criteria')
export class ScoringCriterion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'template_id' })
  templateId: string;

  @ManyToOne(() => ScoringTemplate, (template) => template.criteria, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template: ScoringTemplate;

  @Index()
  @Column({ name: 'parent_id', nullable: true })
  parentId: string | null;

  @ManyToOne(() => ScoringCriterion, (criterion) => criterion.children, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: ScoringCriterion | null;

  @OneToMany(() => ScoringCriterion, (criterion) => criterion.parent)
  children: ScoringCriterion[];

  @Column({ type: 'enum', enum: ScoringCriterionType })
  type: ScoringCriterionType;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'max_score', type: 'float' })
  maxScore: number;

  @Column({ type: 'float', default: 1 })
  weight: number;

  // Posição entre irmãos (escopo: mesmo templateId + parentId).
  // Renumerado sequencialmente (0..n-1) a cada criação/exclusão/move.
  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ name: 'show_in_judging_sheet', default: true })
  showInJudgingSheet: boolean;

  @Column({ name: 'allow_decimal_scoring', default: true })
  allowDecimalScoring: boolean;

  @Column({ name: 'is_required', default: true })
  isRequired: boolean;

  // Só faz sentido pra type = SCORE_ITEM — grupo não recebe nota,
  // então não tem faixa. `scoreBands` fica null enquanto desligado; o
  // service (ScoringCriteriaService) garante que as faixas, quando
  // presentes, sempre cobrem [0, maxScore] sem sobreposição nem vão —
  // ver assertBandsCoverMaxScore.
  @Column({ name: 'use_score_bands', default: false })
  useScoreBands: boolean;

  @Column({ name: 'score_bands', type: 'jsonb', nullable: true })
  scoreBands: ScoreBand[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

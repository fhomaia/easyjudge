import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ScoringCriterion } from '../../scoring-templates/entities/scoring-criterion.entity';
import { JudgeParticipation } from '../../judges/entities/judge-participation.entity';

// Atribuição de um jurado a um critério-FOLHA (type=score_item) de um
// sistema de pontuação — validado no service, não no schema. Sem
// eventId próprio: deriva via judgeParticipationId -> event_id (toda
// JudgeParticipation já é por evento) e via criterionId ->
// scoring_criteria.template_id (pra filtrar por template) — mesmo
// raciocínio de Team não denormalizar eventId (deriva via
// programId -> program.eventId).
@Entity('criterion_judge_assignments')
@Unique(['criterionId', 'judgeParticipationId'])
export class CriterionJudgeAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'criterion_id' })
  criterionId: string;

  @ManyToOne(() => ScoringCriterion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'criterion_id' })
  criterion: ScoringCriterion;

  @Index()
  @Column({ name: 'judge_participation_id' })
  judgeParticipationId: string;

  @ManyToOne(() => JudgeParticipation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'judge_participation_id' })
  judgeParticipation: JudgeParticipation;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

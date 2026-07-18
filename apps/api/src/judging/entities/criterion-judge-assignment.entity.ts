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
import { ScheduleResource } from '../../schedule/entities/schedule-resource.entity';

// Atribuição de um jurado a um critério-FOLHA (type=score_item) de um
// sistema de pontuação, PARA UM RECURSO ESPECÍFICO (pista/palco) do
// cronograma — um jurado não pode estar em dois palcos ao mesmo tempo,
// então o mesmo critério pode ter jurados diferentes por recurso (ex:
// "Execução" na Pista 1 é um jurado, na Pista 2 é outro). `resourceId`
// aponta pra um ScheduleResource de um dia específico (recurso não tem
// identidade estável entre dias — ver ScheduleResource), então a
// atribuição também é implicitamente por dia através dele. Sem eventId
// próprio: deriva via judgeParticipationId -> event_id (toda
// JudgeParticipation já é por evento) e via criterionId ->
// scoring_criteria.template_id (pra filtrar por template) — mesmo
// raciocínio de Team não denormalizar eventId (deriva via
// programId -> program.eventId).
@Entity('criterion_judge_assignments')
@Unique(['criterionId', 'resourceId', 'judgeParticipationId'])
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
  @Column({ name: 'resource_id' })
  resourceId: string;

  @ManyToOne(() => ScheduleResource, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resource_id' })
  resource: ScheduleResource;

  @Index()
  @Column({ name: 'judge_participation_id' })
  judgeParticipationId: string;

  @ManyToOne(() => JudgeParticipation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'judge_participation_id' })
  judgeParticipation: JudgeParticipation;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

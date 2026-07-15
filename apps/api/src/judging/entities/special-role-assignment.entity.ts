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
import { Event } from '../../events/entities/event.entity';
import { JudgeParticipation } from '../../judges/entities/judge-participation.entity';
import { SpecialJudgeRole } from '../enums/special-judge-role.enum';

// Atribuição de um jurado a uma "função especial" do evento (Jurado de
// Legalidade, Head Judge, ...) — fora da árvore de critérios. Ao
// contrário de CriterionJudgeAssignment, esta guarda o próprio
// eventId: não deriva de nenhum outro pai (não está presa a um
// critério/template).
@Entity('special_role_assignments')
@Unique(['eventId', 'role', 'judgeParticipationId'])
export class SpecialRoleAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'event_id' })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ type: 'enum', enum: SpecialJudgeRole })
  role: SpecialJudgeRole;

  @Index()
  @Column({ name: 'judge_participation_id' })
  judgeParticipationId: string;

  @ManyToOne(() => JudgeParticipation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'judge_participation_id' })
  judgeParticipation: JudgeParticipation;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

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
import { ScheduleResource } from '../../schedule/entities/schedule-resource.entity';
import { SpecialJudgeRole } from '../enums/special-judge-role.enum';

// Atribuição de um jurado a uma "função especial" do evento (Jurado de
// Legalidade, Head Judge, ...) — fora da árvore de critérios, mas
// ainda POR RECURSO (2026-07-19, a pedido do usuário — mesma razão de
// CriterionJudgeAssignment: um jurado não pode estar em duas pistas ao
// mesmo tempo). `resourceId` aponta pra um ScheduleResource de um dia
// específico (recurso não tem identidade estável entre dias — ver
// ScheduleResource), então a atribuição também é implicitamente por
// dia através dele, sem precisar guardar um scheduleDayId à parte
// (mesmo raciocínio de CriterionJudgeAssignment). Ao contrário de
// CriterionJudgeAssignment, esta guarda o próprio eventId: não deriva
// de nenhum critério/template (função especial não é por sistema de
// pontuação).
@Entity('special_role_assignments')
@Unique(['eventId', 'role', 'resourceId', 'judgeParticipationId'])
export class SpecialRoleAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'event_id' })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Index()
  @Column({ name: 'resource_id' })
  resourceId: string;

  @ManyToOne(() => ScheduleResource, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resource_id' })
  resource: ScheduleResource;

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

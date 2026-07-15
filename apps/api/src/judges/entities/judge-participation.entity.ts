import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Event } from '../../events/entities/event.entity';
import { User } from '../../users/entities/user.entity';

// Espelha ProgramParticipation (ver
// apps/api/src/programs/entities/program-participation.entity.ts):
// cada linha é a participação de UM jurado em UM evento específico —
// não o jurado em si. Quando vinculada a um usuário (userId
// preenchido), name/email viram snapshot congelado e a leitura de
// exibição passa a vir do JudgeProfile canônico daquele usuário (ver
// JudgesService.toJudgeView).
@Entity('judge_participations')
export class JudgeParticipation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'event_id' })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  // Quem cadastrou esta linha (o produtor) — usado por
  // JudgesService.findCatalogForUser (o "catálogo" de um produtor é
  // toda linha com createdById dele) e pra validar duplicidade
  // (assertNoDuplicateInCatalog) na hora do cadastro.
  @Index()
  @Column({ name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  // Vínculo opcional com um usuário já cadastrado como role JUDGE —
  // null quando o organizador cadastra o jurado manualmente (não
  // existe como usuário ainda).
  @Index()
  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ length: 150 })
  name: string;

  @Column()
  email: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { EventMemberRole } from '../enums/event-member-role.enum';

// Relação N x N entre User e Event — vinculada pelo aliasId do evento
// (não pelo id de uma versão específica), então a associação sobrevive
// a republicações. Um usuário só pode ter um papel por evento (ver
// índice único (alias_id, user_id) na migration).
@Entity('event_members')
export class EventMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: EventMemberRole })
  role: EventMemberRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

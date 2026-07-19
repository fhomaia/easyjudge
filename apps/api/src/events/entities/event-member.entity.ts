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
import { User } from '../../users/entities/user.entity';
import { EventMemberRole } from '../enums/event-member-role.enum';

// Relação N x N entre User e Event — vinculada pelo aliasId do evento
// (não pelo id de uma versão específica), então a associação sobrevive
// a republicações. Uma linha por PESSOA (não por papel): `roles` é um
// array, já que uma pessoa pode acumular mais de um papel no mesmo
// evento (2026-07-19, a pedido do usuário — antes era um papel por
// linha/único por (alias_id, user_id)).
//
// `userId` é nullable: uma pessoa pode ser cadastrada no roster antes
// de ter conta na plataforma (convite por nome+email, mesmo padrão de
// JudgeParticipation/ProgramParticipation) — nesse estado,
// firstName/lastName/email são o snapshot de exibição. Uma vez
// reclamada (userId preenchido, ver EventsService.
// linkUnclaimedMembersByEmail), a exibição prefere os dados ao vivo de
// `users` (ver EventStaffService.toStaffView) — o snapshot fica
// congelado, não é mais atualizado.
@Entity('event_members')
export class EventMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  @Index()
  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'enum', enum: EventMemberRole, array: true })
  roles: EventMemberRole[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

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
import { Team } from '../../teams/entities/team.entity';

// Renomeado de Team -> Program -> ProgramParticipation (2026-07-15):
// Program (ex-Team) é a instituição/academia (nome, email, cidade,
// estado); esta entidade representa a PARTICIPAÇÃO de um programa num
// evento específico — cada linha aqui é "esse programa nesse evento",
// não o programa em si. Renomeada de Program pra ProgramParticipation
// pra não ficar ambíguo ao lado de ProgramProfile (o dado canônico,
// único por usuário — ver program-profile.entity.ts): quando esta
// linha está vinculada a um usuário (userId preenchido), os dados de
// exibição vêm do ProgramProfile daquele usuário, não mais desta
// linha (ver ProgramsService.toProgramView).
@Entity('program_participations')
export class ProgramParticipation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Identifica o evento pelo aliasId (estável entre versões), não pelo
  // id de uma versão específica — sem FK, mesmo padrão de
  // EventMember.aliasId. Ver migration AddAliasIdToEventScopedChildEntities.
  @Index()
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  // Quem cadastrou esta linha (o produtor) — usado por
  // ProgramsService.findCatalogForUser (o "catálogo" de um produtor é
  // toda linha com createdById dele) e pra validar duplicidade
  // (assertNoDuplicateInCatalog) na hora do cadastro.
  @Index()
  @Column({ name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  // Vínculo opcional com um usuário já cadastrado como role PROGRAM —
  // null quando o organizador cadastra o programa manualmente (não
  // existe como usuário ainda). Uma vez preenchido, name/email/city/
  // state abaixo viram um snapshot congelado (não são mais a fonte de
  // verdade) — a leitura passa a vir do ProgramProfile vinculado, via
  // ProgramsService.toProgramView.
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

  @Column({ length: 100 })
  city: string;

  @Column({ length: 2 })
  state: string;

  @Column({ name: 'logo_url', type: 'varchar', nullable: true })
  logoUrl: string | null;

  @OneToMany(() => Team, (team) => team.program)
  teams: Team[];

  // Não é coluna — populado via loadRelationCountAndMap em
  // ProgramsService.findAllForEvent, só para a listagem.
  teamsCount?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

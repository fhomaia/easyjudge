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

// Vínculo atleta<->programa — GLOBAL, fora de qualquer evento (ao
// contrário de JudgeParticipation/ProgramParticipation, que são "essa
// pessoa nesse evento"). Uma vez com os dois lados resolvidos
// (programUserId + athleteUserId), o atleta ganha o papel ATHLETE em
// TODO evento onde aquele programa tem papel PROGRAM (ver
// AthletesService.syncEventAccessForLink/grantEventAccessForNewProgramEvent)
// — é o que dá acesso a Início/Cronograma/Resultados. `confirmedAt` NÃO
// participa dessa concessão de acesso: só gateia o conteúdo da tela de
// Notas (ver ScoringService.getAthleteOverview). Um atleta pode ter
// vários vínculos (vários programas) ao longo do tempo.
//
// Duas direções de criação, mesmo padrão de convite pendente já usado
// em EventMember/JudgeParticipation/ProgramParticipation:
// - Programa adiciona o atleta (nome/sobrenome/email) antes dele ter
//   conta: `athleteUserId` nulo, firstName/lastName/email = snapshot;
//   nasce com `confirmedAt` já preenchido (foi o próprio programa que
//   criou, não tem o que confirmar).
// - Atleta informa o email do programa (no cadastro ou depois, "Meus
//   programas"): `programUserId` só é preenchido se já existir uma
//   conta PROGRAM com esse email; senão fica nulo, reclamado depois
//   (ver AthletesService.claimPendingLinksForProgram, chamado no
//   AuthService.setPassword). Nasce com `confirmedAt` nulo — precisa de
//   confirmação explícita do programa.
@Entity('athlete_links')
export class AthleteLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'program_user_id', nullable: true })
  programUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_user_id' })
  programUser: User | null;

  // Sempre preenchido (mesmo depois de programUserId resolvido) — é a
  // chave usada por claimPendingLinksForProgram pra reclamar o vínculo
  // quando o programa se cadastra depois do atleta.
  @Column({ name: 'program_email' })
  programEmail: string;

  @Index()
  @Column({ name: 'athlete_user_id', nullable: true })
  athleteUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'athlete_user_id' })
  athleteUser: User | null;

  // Snapshot do atleta, só usado enquanto athleteUserId é nulo (convite
  // do programa por nome+email) — mesmo raciocínio de EventMember.
  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  // Quem criou a linha (o programa ou o próprio atleta) — só auditoria.
  @Column({ name: 'created_by_id', type: 'varchar', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

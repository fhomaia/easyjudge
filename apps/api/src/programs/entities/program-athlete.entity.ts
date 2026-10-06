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
import { ProgramParticipation } from './program-participation.entity';

// Atleta inscrito por um programa NUM evento (2026-10-04). Não é o
// elenco global do programa (AthleteLink): decisão do usuário, por
// LGPD, de não importar nem reaproveitar aquele elenco. A mesma pessoa
// em dois programas do mesmo evento vira uma linha em cada um. Não
// concede acesso nenhum (nem EventMember): por enquanto é só cadastro,
// usado pra marcar quem compete em cada equipe+categoria
// (TeamCategoryAthlete). Unicidade de email e CPF dentro do programa
// fica em índices da migration CreateProgramAthletes.
@Entity('program_athletes')
export class ProgramAthlete {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'program_id' })
  programId: string;

  @ManyToOne(() => ProgramParticipation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_id' })
  program: ProgramParticipation;

  // Evento (sem FK, mesmo padrão de ProgramParticipation.aliasId);
  // limpo por EventsService.deleteEvent via EVENT_SCOPED_ENTITIES.
  @Index()
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  // '' quando o nome informado é uma palavra só.
  @Column({ name: 'last_name', length: 100, default: '' })
  lastName: string;

  @Column({ length: 255 })
  email: string;

  // Só dígitos.
  @Column({ type: 'varchar', length: 11, nullable: true })
  cpf: string | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: string | null;

  // O próprio atleta enviou a parte dele (dados e documentos) enquanto a
  // ficha do programa estava em rascunho (2026-10-06). Opcional e só
  // informativo: o programa pode fazer tudo pelo atleta.
  @Column({
    name: 'athlete_submitted_at',
    type: 'timestamptz',
    nullable: true,
  })
  athleteSubmittedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

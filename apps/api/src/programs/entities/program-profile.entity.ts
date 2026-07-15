import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Perfil canônico do programa, 1:1 com o usuário (role PROGRAM) — a
// fonte única de verdade pra nome/email de contato/cidade/estado uma
// vez que o programa tem conta própria na plataforma. As
// `ProgramParticipation` de cada evento (ver
// program-participation.entity.ts) deixam de guardar cópia própria
// desses dados assim que ficam vinculadas a um userId — a leitura
// passa a vir daqui via join (ProgramsService.toProgramView),
// eliminando a necessidade de propagar edição em N linhas.
@Entity('program_profiles')
export class ProgramProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'user_id' })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 150 })
  name: string;

  @Column({ name: 'contact_email' })
  contactEmail: string;

  // Nullable: um usuário PROGRAM que nunca foi pré-cadastrado por
  // nenhum produtor (então nunca teve uma linha Program de onde
  // herdar cidade/estado) começa sem esses dados — preenche depois
  // pelo próprio perfil.
  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  state: string | null;

  @Column({ name: 'logo_url', type: 'varchar', nullable: true })
  logoUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { DocumentType } from '../../common/enums/document-type.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  // Nulo pra role=athlete que optou por não informar documento no
  // cadastro (opcional pra esse papel — ver RegisterDto). Demais papéis
  // continuam com documento obrigatório na validação de entrada, mesmo
  // com a coluna aceitando null.
  @Column({
    name: 'document_type',
    type: 'enum',
    enum: DocumentType,
    nullable: true,
  })
  documentType: DocumentType | null;

  @Index({ unique: true })
  @Column({ name: 'document_number', type: 'varchar', nullable: true })
  documentNumber: string | null;

  // Só coletada de quem usa CPF (pedido de LGPD, 2026-07-31) — uma
  // instituição com CNPJ não tem data de nascimento. Nula pra quem
  // usa CNPJ ou pulou o documento (athlete/spectator).
  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: string | null;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column({ name: 'team_or_institution_name', nullable: true })
  teamOrInstitutionName?: string;

  // Email do programa informado no cadastro por uma conta ATHLETE — só
  // usado nesse momento pra criar o primeiro AthleteLink (ver
  // AuthService.setPassword/AthletesService.createOrRequestLink), não é
  // atualizado depois disso.
  @Column({ name: 'program_email', nullable: true })
  programEmail?: string;

  // Nulo até o usuário concluir a etapa "definir senha".
  // Enquanto for nulo, o cadastro é considerado incompleto.
  @Column({
    name: 'password_hash',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  passwordHash: string | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  // Registro de aceite dos Termos de Uso/Política de Privacidade
  // (RegisterDto.acceptedTerms, checkbox obrigatório no cadastro desde
  // 2026-07-31) — nulo só pra contas criadas antes dessa data (sem
  // backfill: não temos como saber retroativamente se aceitaram).
  @Column({ name: 'terms_accepted_at', type: 'timestamptz', nullable: true })
  termsAcceptedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

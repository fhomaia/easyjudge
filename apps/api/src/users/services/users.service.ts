import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { AthleteLink } from '../../athletes/entities/athlete-link.entity';
import { RegisterDto } from '../../auth/dto/register.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { PasswordConfirmationDto } from '../dto/password-confirmation.dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { DocumentType } from '../../common/enums/document-type.enum';
import { StorageService } from '../../common/services/storage.service';

// Mesmo valor de AuthService.BCRYPT_SALT_ROUNDS — duplicado aqui de
// propósito (não dá pra importar de lá: AuthModule já importa
// UsersModule, o caminho inverso criaria ciclo).
const BCRYPT_SALT_ROUNDS = 12;

// Identifica QUAL versão dos Termos de Uso/Política de Privacidade foi
// aceita no cadastro (um único checkbox cobre os dois documentos, ver
// RegisterDialog) — sem isso, `termsAcceptedAt` sozinho prova só QUANDO
// alguém aceitou, não O QUÊ. Precisa ser bumpada junto com `updatedAt`
// de TermsOfUsePage/PrivacyPolicyPage (apps/web) sempre que o TEXTO
// mudar de verdade (não a cada typo/formatação) — mesmo formato
// AAAA-MM-DD por ser sortable, independente do texto de exibição
// "1 de agosto de 2026" usado nessas páginas.
const CURRENT_TERMS_VERSION = '2026-08-01';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    // Repositório direto (não importa AthletesModule) — AthletesModule já
    // importa UsersModule, então o caminho inverso criaria import
    // cíclico. Mesmo padrão já usado em NotificationsService/
    // ScoringTemplatesModule pra evitar isso.
    @InjectRepository(AthleteLink)
    private readonly athleteLinksRepository: Repository<AthleteLink>,
    // StorageService é global (CommonModule, ver common.module.ts) —
    // injeta direto sem precisar importar o módulo.
    private readonly storageService: StorageService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  // Comparação sem diferenciar maiúsculas/minúsculas — mesmo padrão já
  // usado em ProgramsService/JudgesService pra achar linhas não
  // reclamadas por email. Usado pra detectar, na hora de cadastrar um
  // programa/jurado manualmente, se o email digitado já pertence a uma
  // conta real da plataforma (pra vincular na hora em vez de criar uma
  // entrada solta e duplicada).
  async findByEmailInsensitive(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  // Usado no login: precisa trazer o passwordHash mesmo com select:false na entidade.
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  // Mesmo padrão de findByEmailWithPassword — usado por
  // deactivateAccount/deleteAccount pra conferir a senha atual.
  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
  }

  // Usado pra popular a lista de "vincular a um programa já
  // cadastrado" na tela de Programas e Equipes.
  findAllByRole(role: UserRole): Promise<User[]> {
    return this.usersRepository.find({
      where: { role },
      order: { firstName: 'ASC' },
    });
  }

  // Usado pelo catálogo de jurados: qualquer usuário pode assumir o
  // papel de jurado num evento, exceto contas PROGRAM (que representam
  // a instituição/academia, não uma pessoa que julga).
  findAllExceptRole(role: UserRole): Promise<User[]> {
    return this.usersRepository
      .createQueryBuilder('user')
      .where('user.role != :role', { role })
      .orderBy('user.firstName', 'ASC')
      .getMany();
  }

  async createPendingUser(dto: RegisterDto): Promise<User> {
    // passwordHash tem select:false na entidade — precisa de addSelect
    // explícito, senão vem sempre undefined mesmo quando existe no banco.
    const existingEmail = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: dto.email })
      .getOne();
    if (existingEmail) {
      if (existingEmail.passwordHash) {
        throw new ConflictException('Este email já está cadastrado.');
      }
      // Cadastro anterior nunca foi finalizado (sem senha definida) — o
      // email não está reservado de verdade, mesmo que o código de
      // verificação já tenha sido confirmado nesse meio-tempo (usuário
      // pode ter perdido acesso à página antes de definir a senha).
      // Remove o pendente (cascata apaga os códigos de verificação) e
      // deixa seguir com um cadastro novo.
      await this.usersRepository.delete(existingEmail.id);
    }

    // Documento agora é opcional pra role=athlete (ver RegisterDto) — só
    // confere duplicidade quando um número de verdade foi informado,
    // senão `documentNumber: undefined` faria a query bater em qualquer
    // linha sem documento.
    const existingDocument = dto.documentNumber
      ? await this.usersRepository.findOne({
          where: { documentNumber: dto.documentNumber },
        })
      : null;
    if (existingDocument) {
      throw new ConflictException('Este documento já está cadastrado.');
    }

    const user = this.usersRepository.create({
      role: dto.role,
      firstName: dto.firstName,
      // role=program não coleta sobrenome (ver RegisterDto) — cai pra
      // string vazia em vez de undefined, satisfazendo a coluna NOT NULL.
      lastName: dto.lastName ?? '',
      documentType: dto.documentType ?? null,
      documentNumber: dto.documentNumber ?? null,
      birthDate: dto.birthDate ?? null,
      email: dto.email,
      teamOrInstitutionName: dto.teamOrInstitutionName,
      programEmail: dto.programEmail,
      passwordHash: null,
      emailVerifiedAt: null,
      // dto.acceptedTerms já é obrigatoriamente `true` aqui (@Equals(true)
      // no DTO barra qualquer outro valor antes de chegar neste método).
      termsAcceptedAt: new Date(),
      termsVersion: CURRENT_TERMS_VERSION,
    });

    return this.usersRepository.save(user);
  }

  async markEmailAsVerified(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      emailVerifiedAt: new Date(),
    });
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.usersRepository.update(userId, { passwordHash });
  }

  // Usado pra decidir, na sidebar, se um usuário ATHLETE aparece como
  // "Atleta" ou "Espectador" (rótulo de conta "Espectador" existe só na
  // UI — no cadastro, quem escolhe essa opção também vira role=athlete,
  // ver RegisterDialog). Exige confirmação (não basta o vínculo existir)
  // pra ficar consistente com "só conta depois que o programa confirma".
  async hasConfirmedAthleteLink(userId: string): Promise<boolean> {
    const count = await this.athleteLinksRepository.count({
      where: { athleteUserId: userId, confirmedAt: Not(IsNull()) },
    });
    return count > 0;
  }

  private async findByIdOrThrow(userId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  // Nome sempre editável; documento/data de nascimento só podem ser
  // PREENCHIDOS uma vez (quem já tem valor salvo não pode trocar por
  // aqui — evita reabrir a mesma discussão de segurança de "editar
  // email" que decidimos deixar de fora do escopo desta tela, ver
  // CLAUDE.md "Página de perfil").
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findByIdOrThrow(userId);

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;

    if (dto.documentNumber !== undefined) {
      if (user.documentNumber) {
        throw new ConflictException(
          'Documento já cadastrado — não pode ser alterado.',
        );
      }
      const existingDocument = await this.usersRepository.findOne({
        where: { documentNumber: dto.documentNumber },
      });
      if (existingDocument) {
        throw new ConflictException('Este documento já está cadastrado.');
      }
      user.documentType = dto.documentType ?? DocumentType.CPF;
      user.documentNumber = dto.documentNumber;
    }

    if (dto.birthDate !== undefined) {
      if (user.birthDate) {
        throw new ConflictException(
          'Data de nascimento já cadastrada — não pode ser alterada.',
        );
      }
      // Mesmas duas checagens de AuthService.register (data futura +
      // idade mínima) — duplicadas aqui pelo mesmo motivo do
      // BCRYPT_SALT_ROUNDS acima (sem import cruzado com AuthModule).
      if (new Date(dto.birthDate) > new Date()) {
        throw new BadRequestException(
          'Data de nascimento não pode ser no futuro.',
        );
      }
      const minAgeDate = new Date();
      minAgeDate.setFullYear(minAgeDate.getFullYear() - 13);
      if (new Date(dto.birthDate) > minAgeDate) {
        throw new BadRequestException(
          'É necessário ter 13 anos ou mais.',
        );
      }
      user.birthDate = dto.birthDate;
    }

    return this.usersRepository.save(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    // passwordHash tem select:false — addSelect explícito, mesmo padrão
    // de findByEmailWithPassword.
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .getOne();
    if (!user || !user.passwordHash) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const currentMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!currentMatches) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      BCRYPT_SALT_ROUNDS,
    );
    await this.usersRepository.update(userId, { passwordHash });
  }

  private async assertPasswordMatches(
    userId: string,
    password: string,
  ): Promise<User> {
    const user = await this.findByIdWithPassword(userId);
    if (!user || !user.passwordHash) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Senha incorreta.');
    }
    return user;
  }

  // Reversível — voltar a fazer login com email+senha corretos já
  // reativa a conta sozinho (ver AuthService.login), sem precisar de
  // suporte.
  async deactivateAccount(
    userId: string,
    dto: PasswordConfirmationDto,
  ): Promise<void> {
    const user = await this.assertPasswordMatches(userId, dto.password);
    user.active = false;
    user.deactivatedAt = new Date();
    await this.usersRepository.save(user);
  }

  // Chamado só por AuthService.login, quando o login de uma conta
  // desativada (não excluída) tem sucesso — não é exposto por endpoint
  // próprio porque a reativação É o login.
  async reactivate(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      active: true,
      deactivatedAt: null,
    });
  }

  // Irreversível. Não apaga a linha (Event.createdById,
  // EventActivityLog.actorId, JudgeParticipation/ProgramParticipation/
  // ScoringTemplate.createdById são NOT NULL com ON DELETE NO ACTION —
  // ver CLAUDE.md) — só anonimiza os dados pessoais e zera a senha,
  // então login nunca mais funciona. `EventMember`/rosters guardam seu
  // próprio snapshot de nome, então histórico de eventos passados não
  // é afetado.
  async deleteAccount(
    userId: string,
    dto: PasswordConfirmationDto,
  ): Promise<void> {
    const user = await this.assertPasswordMatches(userId, dto.password);
    user.firstName = 'Usuário';
    user.lastName = 'excluído';
    // TLD .invalid é reservado pela RFC 2606 pra exatamente esse uso —
    // nunca resolve de verdade, e libera o email real pra um cadastro
    // novo (a coluna é unique).
    user.email = `deleted-${userId}@cheercup.invalid`;
    user.documentType = null;
    user.documentNumber = null;
    user.birthDate = null;
    // Não apaga o arquivo em si do storage — só a referência (mesmo
    // comportamento que removeAvatar já tem hoje; não existe método de
    // exclusão no StorageService).
    user.avatarUrl = null;
    user.teamOrInstitutionName = null;
    user.programEmail = null;
    user.passwordHash = null;
    user.active = false;
    user.deletedAt = new Date();
    user.deactivatedAt = null;
    await this.usersRepository.save(user);
  }

  async setAvatar(userId: string, file: Express.Multer.File): Promise<User> {
    const user = await this.findByIdOrThrow(userId);
    user.avatarUrl = await this.storageService.upload(file, 'avatars');
    return this.usersRepository.save(user);
  }

  async removeAvatar(userId: string): Promise<void> {
    await this.usersRepository.update(userId, { avatarUrl: null });
  }
}

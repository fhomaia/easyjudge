import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { RegisterDto } from '../../auth/dto/register.dto';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
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

    const existingDocument = await this.usersRepository.findOne({
      where: { documentNumber: dto.documentNumber },
    });
    if (existingDocument) {
      throw new ConflictException('Este documento já está cadastrado.');
    }

    const user = this.usersRepository.create({
      role: dto.role,
      firstName: dto.firstName,
      lastName: dto.lastName,
      documentType: dto.documentType,
      documentNumber: dto.documentNumber,
      email: dto.email,
      teamOrInstitutionName: dto.teamOrInstitutionName,
      passwordHash: null,
      emailVerifiedAt: null,
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
}

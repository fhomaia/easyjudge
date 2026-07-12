import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { RegisterDto } from '../auth/dto/register.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
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

  async createPendingUser(dto: RegisterDto): Promise<User> {
    const existingEmail = await this.usersRepository.findOne({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Este email já está cadastrado.');
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

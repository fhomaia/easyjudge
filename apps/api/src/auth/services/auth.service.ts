import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { UsersService } from '../../users/services/users.service';
import { MailService } from './mail.service';
import { EmailVerification } from '../entities/email-verification.entity';
import { RegisterDto } from '../dto/register.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { SetPasswordDto } from '../dto/set-password.dto';
import { LoginDto } from '../dto/login.dto';

const CODE_LENGTH = 6;
const CODE_EXPIRATION_MINUTES = 15;
const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(EmailVerification)
    private readonly emailVerificationRepository: Repository<EmailVerification>,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  // Etapa 1: cria o usuário "pendente" e dispara o código de verificação.
  async register(dto: RegisterDto): Promise<{ userId: string }> {
    const user = await this.usersService.createPendingUser(dto);
    await this.issueVerificationCode(user.id, dto.email);
    return { userId: user.id };
  }

  async resendVerificationCode(userId: string): Promise<{ ok: true }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('Usuário não encontrado.');
    }
    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email já verificado.');
    }

    // Throttle simples: bloqueia reenvio antes de 60s do último código.
    const lastCode = await this.emailVerificationRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    if (lastCode) {
      const secondsSinceLast =
        (Date.now() - lastCode.createdAt.getTime()) / 1000;
      if (secondsSinceLast < 60) {
        throw new BadRequestException(
          'Aguarde antes de solicitar um novo código.',
        );
      }
    }

    await this.issueVerificationCode(userId, user.email);
    return { ok: true };
  }

  private async issueVerificationCode(
    userId: string,
    email: string,
  ): Promise<void> {
    // Invalida códigos anteriores ainda não usados, evitando confusão
    // de qual código é o válido caso o usuário peça reenvio.
    await this.emailVerificationRepository.update(
      { userId, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const code = this.generateNumericCode(CODE_LENGTH);
    const expiresAt = new Date(
      Date.now() + CODE_EXPIRATION_MINUTES * 60 * 1000,
    );

    const verification = this.emailVerificationRepository.create({
      userId,
      code,
      expiresAt,
      usedAt: null,
    });
    await this.emailVerificationRepository.save(verification);

    await this.mailService.sendVerificationCode(email, code);
  }

  private generateNumericCode(length: number): string {
    // Usa crypto para gerar dígitos aleatórios de forma segura.
    const max = 10 ** length;
    const num = crypto.randomInt(0, max);
    return num.toString().padStart(length, '0');
  }

  // Etapa 2: valida o código enviado por email.
  async verifyEmail(dto: VerifyEmailDto): Promise<{ ok: true }> {
    const verification = await this.emailVerificationRepository.findOne({
      where: {
        userId: dto.userId,
        code: dto.code,
      },
      order: { createdAt: 'DESC' },
    });

    if (!verification) {
      throw new BadRequestException('Código inválido.');
    }
    if (verification.usedAt) {
      throw new BadRequestException('Código já utilizado.');
    }
    if (verification.expiresAt < new Date()) {
      throw new BadRequestException('Código expirado.');
    }

    verification.usedAt = new Date();
    await this.emailVerificationRepository.save(verification);

    await this.usersService.markEmailAsVerified(dto.userId);

    return { ok: true };
  }

  // Etapa 3: define a senha e já retorna o usuário logado.
  async setPassword(dto: SetPasswordDto): Promise<{ accessToken: string }> {
    const user = await this.usersService.findById(dto.userId);
    if (!user) {
      throw new BadRequestException('Usuário não encontrado.');
    }
    if (!user.emailVerifiedAt) {
      throw new BadRequestException(
        'Email ainda não verificado. Conclua a verificação antes de definir a senha.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    await this.usersService.setPasswordHash(user.id, passwordHash);

    return this.buildAccessToken(user.id, user.role);
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    // Mensagem genérica de propósito — não revelar se o email existe ou não.
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email ou senha inválidos.');
    }
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException(
        'Cadastro incompleto. Verifique seu email.',
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Email ou senha inválidos.');
    }

    return this.buildAccessToken(user.id, user.role);
  }

  private buildAccessToken(
    userId: string,
    role: string,
  ): { accessToken: string } {
    const payload = { sub: userId, role };
    return { accessToken: this.jwtService.sign(payload) };
  }
}

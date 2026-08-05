import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { UsersService } from '../../users/services/users.service';
import { ProgramsService } from '../../programs/services/programs.service';
import { JudgesService } from '../../judges/services/judges.service';
import { EventsService } from '../../events/services/events.service';
import { AthletesService } from '../../athletes/services/athletes.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { DocumentType } from '../../common/enums/document-type.enum';
import { IMPERSONATOR_EMAIL } from '../../common/constants/impersonation';
import { MailService } from './mail.service';
import { EmailVerification } from '../entities/email-verification.entity';
import { PasswordReset } from '../entities/password-reset.entity';
import { RegisterDto } from '../dto/register.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { SetPasswordDto } from '../dto/set-password.dto';
import { LoginDto } from '../dto/login.dto';
import { ImpersonateDto } from '../dto/impersonate.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { VerifyPasswordResetDto } from '../dto/verify-password-reset.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';

const CODE_LENGTH = 6;
const CODE_EXPIRATION_MINUTES = 15;
const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(EmailVerification)
    private readonly emailVerificationRepository: Repository<EmailVerification>,
    @InjectRepository(PasswordReset)
    private readonly passwordResetRepository: Repository<PasswordReset>,
    private readonly usersService: UsersService,
    private readonly programsService: ProgramsService,
    private readonly judgesService: JudgesService,
    private readonly eventsService: EventsService,
    private readonly athletesService: AthletesService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  // Etapa 1: cria o usuário "pendente" e dispara o código de verificação.
  async register(dto: RegisterDto): Promise<{ userId: string }> {
    // Atleta (inclui "espectador" do frontend, que chega como
    // role=athlete — ver RegisterDialog) só pode informar CPF — a UI já
    // restringe isso, reforçado aqui pra quem chamar a API direto.
    if (dto.role === UserRole.ATHLETE && dto.documentType === DocumentType.CNPJ) {
      throw new BadRequestException('Atletas só podem informar CPF.');
    }
    // O calendário do frontend já bloqueia datas futuras (DatePicker
    // maxDate) — reforçado aqui pra quem chamar a API direto.
    if (dto.birthDate && new Date(dto.birthDate) > new Date()) {
      throw new BadRequestException(
        'Data de nascimento não pode ser no futuro.',
      );
    }
    // Idade mínima de 13 anos (2026-08-01, ver CLAUDE.md — revisado de
    // 18 pra 13 a pedido do usuário). Sem fluxo de consentimento de
    // responsável legal (LGPD art. 14) — a mitigação é a cláusula de
    // autodeclaração de idade nos Termos de Uso (`TermsOfUsePage`,
    // "Cadastro e conta"), não uma verificação de fato. O calendário do
    // frontend já bloqueia datas mais recentes que esta (DatePicker
    // maxDate na etapa "birthDate"), reforçado aqui pra quem chamar a
    // API direto.
    if (dto.birthDate) {
      const minAgeDate = new Date();
      minAgeDate.setFullYear(minAgeDate.getFullYear() - 13);
      if (new Date(dto.birthDate) > minAgeDate) {
        throw new BadRequestException(
          'É necessário ter 13 anos ou mais para se cadastrar.',
        );
      }
    }
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

    // Reclama qualquer convite pendente no roster de acessos de evento
    // (EventMember com userId ainda null, ver EventStaffController) com
    // esse email, incondicional (qualquer role) — precisa rodar ANTES
    // dos links abaixo: JudgesService.linkUnclaimedJudgesByEmail também
    // grava no roster (papel "jurado"), e faz isso buscando a linha
    // pelo userId já vinculado — se essa chamada rodasse antes, criaria
    // uma linha duplicada em vez de achar a pendente.
    await this.eventsService.linkUnclaimedMembersByEmail(user.id, user.email);

    // Cadastro só é considerado completo aqui (com senha definida) —
    // é o momento certo pra vincular automaticamente qualquer
    // ProgramParticipation cadastrada manualmente por um organizador
    // (userId ainda null) com o mesmo email, em qualquer evento. Ver
    // ProgramsService.linkUnclaimedProgramsByEmail. Mesmo padrão vale
    // pra jurados logo abaixo (JudgesService.linkUnclaimedJudgesByEmail)
    // — qualquer role menos PROGRAM pode ser jurado, não só JUDGE.
    if (user.role === UserRole.PROGRAM) {
      await this.programsService.linkUnclaimedProgramsByEmail(user.id, {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        teamOrInstitutionName: user.teamOrInstitutionName,
      });
      // Reclama pedidos de vínculo que ATLETAS já tinham feito (por
      // email) antes deste programa ter conta — ver
      // AthletesService.claimPendingLinksForProgram.
      await this.athletesService.claimPendingLinksForProgram(
        user.id,
        user.email,
      );
    } else {
      await this.judgesService.linkUnclaimedJudgesByEmail(user.id, {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      if (user.role === UserRole.ATHLETE) {
        // Reclama convites que um PROGRAMA já tinha criado (por email)
        // pra este atleta antes dele ter conta.
        await this.athletesService.linkUnclaimedAthleteInvitesByEmail(
          user.id,
          user.email,
        );
        // Vínculo inicial informado no cadastro (ver RegisterDto.
        // programEmail) — opcional, fica pendente de confirmação do
        // programa (ver AthletesService.createOrRequestLink).
        if (user.programEmail) {
          await this.athletesService.createOrRequestLink(
            user.id,
            user.programEmail,
          );
        }
      }
    }

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

    // Conta desativada (não excluída — essa já teria caído no !user.
    // passwordHash acima, já que a exclusão zera a senha): login com a
    // senha certa já reativa sozinho, sem precisar de suporte.
    if (!user.active) {
      await this.usersService.reactivate(user.id);
    }

    return this.buildAccessToken(user.id, user.role);
  }

  // Etapa 1 de "esqueci minha senha": retorna sempre { resetId }, na
  // MESMA forma, nunca revelando se o email existe (mesmo raciocínio de
  // login acima) — o frontend mostra "você vai receber um email se o
  // cadastro for encontrado" independente do resultado real, e usa o
  // resetId pra seguir pra tela de código. Quando o email não
  // corresponde a ninguém, a linha criada não tem userId/code — o
  // restante do fluxo (verify/reset) rejeita com "Código inválido." do
  // mesmo jeito que rejeitaria um código errado numa linha real, sem
  // nenhum branch sobre existir ou não.
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ resetId: string }> {
    const user = await this.usersService.findByEmailInsensitiveWithPassword(
      dto.email,
    );

    // Só faz sentido gerar/enviar código pra quem já concluiu o
    // cadastro (tem senha definida) — conta pendente de verificação não
    // tem senha pra redefinir ainda, segue o fluxo normal de cadastro.
    if (user && user.passwordHash) {
      // Throttle de 60s, mesmo padrão de resendVerificationCode — evita
      // spam de email pra quem tem conta de verdade. Reaproveita a
      // sessão de reset já em andamento (mesmo resetId/código) em vez
      // de rejeitar, já que o código anterior ainda está na caixa de
      // entrada e continua válido.
      const lastReset = await this.passwordResetRepository.findOne({
        where: { userId: user.id },
        order: { createdAt: 'DESC' },
      });
      if (lastReset) {
        const secondsSinceLast =
          (Date.now() - lastReset.createdAt.getTime()) / 1000;
        if (
          secondsSinceLast < 60 &&
          !lastReset.usedAt &&
          lastReset.expiresAt > new Date()
        ) {
          return { resetId: lastReset.id };
        }
      }

      const code = this.generateNumericCode(CODE_LENGTH);
      const expiresAt = new Date(
        Date.now() + CODE_EXPIRATION_MINUTES * 60 * 1000,
      );
      const reset = this.passwordResetRepository.create({
        userId: user.id,
        code,
        expiresAt,
        verifiedAt: null,
        usedAt: null,
      });
      await this.passwordResetRepository.save(reset);
      await this.mailService.sendPasswordResetCode(user.email, code);
      return { resetId: reset.id };
    }

    const dummy = this.passwordResetRepository.create({
      userId: null,
      code: null,
      expiresAt: new Date(Date.now() + CODE_EXPIRATION_MINUTES * 60 * 1000),
      verifiedAt: null,
      usedAt: null,
    });
    await this.passwordResetRepository.save(dummy);
    return { resetId: dummy.id };
  }

  // Etapa 2: confirma o código. Não distingue "email não existia" de
  // "código errado" — as duas caem em "Código inválido.", já que uma
  // linha com userId null nunca vai ter código igual ao que o usuário
  // digitou (código só é gerado quando o usuário existe, ver acima).
  async verifyPasswordReset(dto: VerifyPasswordResetDto): Promise<{ ok: true }> {
    const reset = await this.passwordResetRepository.findOne({
      where: { id: dto.resetId },
    });

    if (!reset || !reset.code || reset.code !== dto.code) {
      throw new BadRequestException('Código inválido.');
    }
    if (reset.usedAt) {
      throw new BadRequestException('Código já utilizado.');
    }
    if (reset.expiresAt < new Date()) {
      throw new BadRequestException('Código expirado.');
    }

    reset.verifiedAt = new Date();
    await this.passwordResetRepository.save(reset);

    return { ok: true };
  }

  // Etapa 3: define a nova senha. Exige que o código já tenha sido
  // confirmado (verifiedAt) nesta mesma "sessão" de reset.
  async resetPassword(dto: ResetPasswordDto): Promise<{ ok: true }> {
    const reset = await this.passwordResetRepository.findOne({
      where: { id: dto.resetId },
    });

    if (!reset || !reset.verifiedAt || !reset.userId) {
      throw new BadRequestException('Código inválido.');
    }
    if (reset.usedAt) {
      throw new BadRequestException('Código já utilizado.');
    }
    if (reset.expiresAt < new Date()) {
      throw new BadRequestException('Código expirado.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    await this.usersService.setPasswordHash(reset.userId, passwordHash);

    reset.usedAt = new Date();
    await this.passwordResetRepository.save(reset);

    return { ok: true };
  }

  // "Entrar como" qualquer usuário, restrito a uma única conta
  // (IMPERSONATOR_EMAIL) — ver plano/CLAUDE.md pra contexto. A trava é
  // sempre a identidade REAL por trás do JWT que está chamando (não um
  // header/flag do cliente), então uma sessão já impersonada não
  // consegue impersonar de novo (o `sub` do JWT nesse caso é do
  // usuário-alvo, não do dono).
  async impersonate(
    callerUserId: string,
    dto: ImpersonateDto,
  ): Promise<{
    accessToken: string;
    impersonating: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
    };
  }> {
    const caller = await this.usersService.findById(callerUserId);
    if (!caller || caller.email.toLowerCase() !== IMPERSONATOR_EMAIL) {
      throw new ForbiddenException('Você não tem permissão para isso.');
    }

    const target = await this.usersService.findByEmailInsensitive(dto.email);
    if (!target) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    if (target.id === caller.id) {
      throw new BadRequestException('Você já está na sua própria conta.');
    }

    console.log(
      `[impersonate] ${caller.email} entrou como ${target.email} (${target.id}) em ${new Date().toISOString()}`,
    );

    return {
      ...this.buildAccessToken(target.id, target.role),
      impersonating: {
        id: target.id,
        firstName: target.firstName,
        lastName: target.lastName,
        email: target.email,
        role: target.role,
      },
    };
  }

  private buildAccessToken(
    userId: string,
    role: string,
  ): { accessToken: string } {
    const payload = { sub: userId, role };
    return { accessToken: this.jwtService.sign(payload) };
  }
}

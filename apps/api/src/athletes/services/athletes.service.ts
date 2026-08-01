import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { AthleteLink } from '../entities/athlete-link.entity';
import { CreateAthleteLinkDto } from '../dto/create-athlete-link.dto';
import { EventsService } from '../../events/services/events.service';
import { EventMemberRole } from '../../events/enums/event-member-role.enum';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../common/enums/user-role.enum';

export interface AthleteLinkView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  programEmail: string;
  hasAccount: boolean;
  programResolved: boolean;
  confirmed: boolean;
  createdAt: string;
}

// Vínculo atleta<->programa, GLOBAL (fora de qualquer evento) — ver
// AthleteLink. Concede acesso de evento (papel ATHLETE) assim que os
// dois lados estão resolvidos, independente de confirmado — ver
// comentário na entidade e no enum EventMemberRole.
@Injectable()
export class AthletesService {
  constructor(
    @InjectRepository(AthleteLink)
    private readonly linksRepo: Repository<AthleteLink>,
    private readonly eventsService: EventsService,
    private readonly usersService: UsersService,
  ) {}

  // Programa gerenciando o próprio elenco (AthleteRosterController).
  async listForProgram(programUserId: string): Promise<AthleteLinkView[]> {
    const links = await this.linksRepo.find({
      where: { programUserId },
      order: { createdAt: 'DESC' },
    });
    return links.map((l) => this.toView(l));
  }

  // Programa adiciona um atleta por nome/sobrenome/email — nasce já
  // confirmado (foi o próprio programa que criou, não tem o que
  // confirmar). Casa com uma conta ATHLETE existente por email, se
  // houver; senão fica como convite pendente (mesmo padrão de
  // JudgeParticipation/ProgramParticipation).
  async create(
    programUserId: string,
    dto: CreateAthleteLinkDto,
  ): Promise<AthleteLinkView> {
    const email = dto.email.trim();
    const existing = await this.linksRepo
      .createQueryBuilder('link')
      .where('link.programUserId = :programUserId', { programUserId })
      .andWhere('LOWER(link.email) = LOWER(:email)', { email })
      .getOne();
    if (existing) {
      throw new ConflictException('Este atleta já está no seu elenco.');
    }

    const programUser = await this.usersService.findById(programUserId);
    if (!programUser) throw new NotFoundException('Programa não encontrado.');

    const athleteUser = await this.usersService.findByEmailInsensitive(email);
    const athleteUserId =
      athleteUser && athleteUser.role === UserRole.ATHLETE
        ? athleteUser.id
        : null;

    const link = this.linksRepo.create({
      programUserId,
      programEmail: programUser.email,
      athleteUserId,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email,
      confirmedAt: new Date(),
      createdById: programUserId,
    });
    const saved = await this.linksRepo.save(link);

    if (athleteUserId) await this.syncEventAccessForLink(saved);

    return this.toView(saved);
  }

  async remove(programUserId: string, linkId: string): Promise<void> {
    const link = await this.linksRepo.findOneBy({ id: linkId, programUserId });
    if (!link) throw new NotFoundException('Vínculo não encontrado.');
    await this.revokeEventAccessForLink(link);
    await this.linksRepo.remove(link);
  }

  // Atleta se desvinculando do PRÓPRIO lado ("Meus programas") — mesmo
  // efeito de `remove` (acima, lado do programa), só escopado por
  // athleteUserId em vez de programUserId.
  async removeMyLink(athleteUserId: string, linkId: string): Promise<void> {
    const link = await this.linksRepo.findOneBy({ id: linkId, athleteUserId });
    if (!link) throw new NotFoundException('Vínculo não encontrado.');
    await this.revokeEventAccessForLink(link);
    await this.linksRepo.remove(link);
  }

  // Programa confirma um vínculo que o ATLETA iniciou (informou o email
  // do programa no cadastro/"Meus programas"). O papel ATHLETE já foi
  // concedido na criação/reclamação do vínculo (ver
  // syncEventAccessForLink) — confirmar só libera o conteúdo de Notas
  // (checado em ScoringService.getAthleteOverview), não mexe em
  // EventMember.
  async confirm(
    programUserId: string,
    linkId: string,
  ): Promise<AthleteLinkView> {
    const link = await this.linksRepo.findOneBy({ id: linkId, programUserId });
    if (!link) throw new NotFoundException('Vínculo não encontrado.');
    if (!link.confirmedAt) {
      link.confirmedAt = new Date();
      await this.linksRepo.save(link);
    }
    return this.toView(link);
  }

  // Atleta pedindo vínculo a um programa por email — no cadastro
  // (AuthService.setPassword) ou depois ("Meus programas"). Fica sempre
  // pendente de confirmação (foi o atleta quem iniciou). Se o programa
  // ainda não tem conta, `programUserId` fica nulo — reclamado depois
  // por claimPendingLinksForProgram.
  async createOrRequestLink(
    athleteUserId: string,
    programEmail: string,
  ): Promise<AthleteLinkView> {
    const email = programEmail.trim();
    const existing = await this.linksRepo
      .createQueryBuilder('link')
      .where('link.athleteUserId = :athleteUserId', { athleteUserId })
      .andWhere('LOWER(link.programEmail) = LOWER(:email)', { email })
      .getOne();
    if (existing) {
      throw new ConflictException('Você já pediu vínculo com esse programa.');
    }

    const athleteUser = await this.usersService.findById(athleteUserId);
    if (!athleteUser) throw new NotFoundException('Atleta não encontrado.');

    const programUser = await this.usersService.findByEmailInsensitive(email);
    const programUserId =
      programUser && programUser.role === UserRole.PROGRAM
        ? programUser.id
        : null;

    const link = this.linksRepo.create({
      programUserId,
      programEmail: email,
      athleteUserId,
      firstName: athleteUser.firstName,
      lastName: athleteUser.lastName,
      email: athleteUser.email,
      confirmedAt: null,
      createdById: athleteUserId,
    });
    const saved = await this.linksRepo.save(link);

    if (programUserId) await this.syncEventAccessForLink(saved);

    return this.toView(saved);
  }

  async listMyPrograms(athleteUserId: string): Promise<AthleteLinkView[]> {
    const links = await this.linksRepo.find({
      where: { athleteUserId },
      order: { createdAt: 'DESC' },
    });
    return links.map((l) => this.toView(l));
  }

  // Chamado por AuthService.setPassword quando uma conta ATHLETE
  // completa o cadastro — reclama convites que um PROGRAMA já tinha
  // criado (por email) antes do atleta ter conta.
  async linkUnclaimedAthleteInvitesByEmail(
    athleteUserId: string,
    email: string,
  ): Promise<void> {
    const unclaimed = await this.linksRepo
      .createQueryBuilder('link')
      .where('LOWER(link.email) = LOWER(:email)', { email })
      .andWhere('link.athleteUserId IS NULL')
      .getMany();
    for (const link of unclaimed) {
      link.athleteUserId = athleteUserId;
      const saved = await this.linksRepo.save(link);
      if (saved.programUserId) await this.syncEventAccessForLink(saved);
    }
  }

  // Chamado por AuthService.setPassword quando uma conta PROGRAM
  // completa o cadastro — reclama pedidos de vínculo que ATLETAS já
  // tinham feito (por email) antes do programa ter conta. Não confirma
  // nada (isso continua exigindo uma ação explícita do programa), só
  // concede o acesso de evento (ver syncEventAccessForLink).
  async claimPendingLinksForProgram(
    programUserId: string,
    programEmail: string,
  ): Promise<void> {
    const unclaimed = await this.linksRepo
      .createQueryBuilder('link')
      .where('LOWER(link.programEmail) = LOWER(:email)', {
        email: programEmail,
      })
      .andWhere('link.programUserId IS NULL')
      .getMany();
    for (const link of unclaimed) {
      link.programUserId = programUserId;
      const saved = await this.linksRepo.save(link);
      if (saved.athleteUserId) await this.syncEventAccessForLink(saved);
    }
  }

  // Usado por ScoringService.getAthleteOverview — a quais programas
  // (userId) este atleta tem vínculo CONFIRMADO, pra filtrar as
  // apresentações visíveis em Notas.
  async getConfirmedProgramUserIds(athleteUserId: string): Promise<string[]> {
    const links = await this.linksRepo.find({
      where: { athleteUserId, confirmedAt: Not(IsNull()) },
    });
    return links
      .map((l) => l.programUserId)
      .filter((id): id is string => id !== null);
  }

  // Concede o papel ATHLETE em todo evento onde `programUserId` já tem
  // papel PROGRAM — chamado sempre que um vínculo passa a ter os dois
  // lados resolvidos (criação, ou reclamação por email de qualquer um
  // dos dois lados). Independente de confirmado (ver comentário na
  // entidade/enum).
  private async syncEventAccessForLink(link: AthleteLink): Promise<void> {
    if (!link.programUserId || !link.athleteUserId) return;
    const aliasIds = await this.eventsService.findAliasIdsForMemberRole(
      link.programUserId,
      EventMemberRole.PROGRAM,
    );
    for (const aliasId of aliasIds) {
      await this.eventsService.upsertMemberRole(
        aliasId,
        EventMemberRole.ATHLETE,
        {
          userId: link.athleteUserId,
          email: link.email ?? link.programEmail,
          firstName: link.firstName,
          lastName: link.lastName,
        },
      );
    }
  }

  // Inverso de syncEventAccessForLink — chamado ao desfazer um vínculo
  // (de qualquer lado, ver remove/removeMyLink). Tira ATHLETE de todo
  // evento onde esse programa concedeu o papel, mas não deixa a pessoa
  // sem nenhum acesso: ela cai pra SPECTATOR no lugar (pedido explícito
  // do usuário) — mesmo raciocínio de "resgate de código" já usado em
  // EventsService.joinByCode, upsertMemberRole é idempotente então não
  // duplica nem rebaixa quem já tiver um papel maior por outro motivo
  // (ex: também é jurado nesse evento).
  private async revokeEventAccessForLink(link: AthleteLink): Promise<void> {
    if (!link.programUserId || !link.athleteUserId) return;
    const aliasIds = await this.eventsService.findAliasIdsForMemberRole(
      link.programUserId,
      EventMemberRole.PROGRAM,
    );
    const identity = {
      userId: link.athleteUserId,
      email: link.email ?? link.programEmail,
      firstName: link.firstName,
      lastName: link.lastName,
    };
    for (const aliasId of aliasIds) {
      await this.eventsService.removeMemberRole(
        aliasId,
        EventMemberRole.ATHLETE,
        identity,
      );
      await this.eventsService.upsertMemberRole(
        aliasId,
        EventMemberRole.SPECTATOR,
        identity,
      );
    }
  }

  // Chamado por ProgramsService quando um programa entra num evento
  // NOVO (create/linkUnclaimedProgramsByEmail) — replica o acesso pra
  // todo atleta já vinculado a ele (dois lados resolvidos), regardless
  // de confirmado.
  async grantEventAccessForNewProgramEvent(
    programUserId: string,
    aliasId: string,
  ): Promise<void> {
    const links = await this.linksRepo.find({
      where: { programUserId, athleteUserId: Not(IsNull()) },
    });
    for (const link of links) {
      if (!link.athleteUserId) continue;
      await this.eventsService.upsertMemberRole(
        aliasId,
        EventMemberRole.ATHLETE,
        {
          userId: link.athleteUserId,
          email: link.email ?? link.programEmail,
          firstName: link.firstName,
          lastName: link.lastName,
        },
      );
    }
  }

  private toView(link: AthleteLink): AthleteLinkView {
    return {
      id: link.id,
      firstName: link.firstName ?? '',
      lastName: link.lastName ?? '',
      email: link.email ?? '',
      programEmail: link.programEmail,
      hasAccount: link.athleteUserId !== null,
      programResolved: link.programUserId !== null,
      confirmed: link.confirmedAt !== null,
      createdAt: link.createdAt.toISOString(),
    };
  }
}

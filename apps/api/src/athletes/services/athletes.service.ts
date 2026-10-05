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
import { EventStatus } from '../../events/enums/event-status.enum';
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
  // Convite pendente cujo email virou uma conta Programa depois do
  // convite: nunca vai ser aceito (Programa não pode ser atleta). Só o
  // elenco do programa preenche; nas outras respostas é sempre false.
  emailIsProgramAccount: boolean;
  // Nome do evento quando o pedido veio do produtor (ver
  // requestLinkFromEvent); nulo nos outros casos.
  requestedFromEvent: string | null;
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
      where: { programUserId, endedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    const pendingEmails = links
      .filter((l) => l.athleteUserId === null && l.email)
      .map((l) => l.email as string);
    const programEmails =
      await this.usersService.findProgramAccountEmails(pendingEmails);
    return links.map((l) =>
      this.toView(
        l,
        l.athleteUserId === null &&
          !!l.email &&
          programEmails.has(l.email.toLowerCase()),
      ),
    );
  }

  // Vínculos ativos do programa esperando confirmação (pedidos do atleta
  // ou do produtor de um evento; os criados pelo programa já nascem
  // confirmados). Mesmo critério do botão "Confirmar vínculo" do elenco.
  countPendingForProgram(programUserId: string): Promise<number> {
    return this.linksRepo.count({
      where: { programUserId, endedAt: IsNull(), confirmedAt: IsNull() },
    });
  }

  // Programa adiciona um atleta por nome/sobrenome/email — nasce já
  // confirmado (foi o próprio programa que criou, não tem o que
  // confirmar). Casa com uma conta existente por email, de qualquer tipo
  // menos Programa (Programa não pode ser atleta, mesma regra do
  // jurado); sem conta, fica como convite pendente (mesmo padrão de
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
      .andWhere('link.endedAt IS NULL')
      .getOne();
    if (existing) {
      throw new ConflictException('Este atleta já está no seu elenco.');
    }

    const programUser = await this.usersService.findById(programUserId);
    if (!programUser) throw new NotFoundException('Programa não encontrado.');

    const athleteUser = await this.usersService.findByEmailInsensitive(email);
    if (athleteUser?.role === UserRole.PROGRAM) {
      throw new ConflictException(
        'Este email pertence a uma conta de Programa, que não pode ser atleta.',
      );
    }
    const athleteUserId = athleteUser?.id ?? null;

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
    const link = await this.linksRepo.findOneBy({
      id: linkId,
      programUserId,
      endedAt: IsNull(),
    });
    if (!link) throw new NotFoundException('Vínculo não encontrado.');
    await this.endLink(link);
  }

  // Atleta se desvinculando do PRÓPRIO lado ("Meus programas") — mesmo
  // efeito de `remove` (acima, lado do programa), só escopado por
  // athleteUserId em vez de programUserId.
  async removeMyLink(athleteUserId: string, linkId: string): Promise<void> {
    const link = await this.linksRepo.findOneBy({
      id: linkId,
      athleteUserId,
      endedAt: IsNull(),
    });
    if (!link) throw new NotFoundException('Vínculo não encontrado.');
    await this.endLink(link);
  }

  // Atleta saindo da equipe (qualquer um dos lados). Convite/pedido que
  // nunca teve os dois lados resolvidos não deu acesso nenhum: só apaga.
  // Senão o vínculo é ENCERRADO, não apagado (decisão do usuário,
  // 2026-10-03): quem sai mantém o histórico dos eventos já iniciados ou
  // concluídos e perde o papel só nos que ainda não começaram (ver
  // revokeEventAccessForLink e getConfirmedProgramUserIds).
  private async endLink(link: AthleteLink): Promise<void> {
    if (!link.programUserId || !link.athleteUserId) {
      await this.linksRepo.remove(link);
      return;
    }
    await this.revokeEventAccessForLink(link);
    link.endedAt = new Date();
    await this.linksRepo.save(link);
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
    const link = await this.linksRepo.findOneBy({
      id: linkId,
      programUserId,
      endedAt: IsNull(),
    });
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
      .andWhere('link.endedAt IS NULL')
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

  // Produtor cadastrou o atleta num programa do evento (ProgramAthlete,
  // ver ProgramAthletesService): pede o vínculo em nome do evento, sem
  // confirmar (decisão do usuário, 2026-10-05). Se quem cadastrou foi o
  // próprio programa (inscrição), `eventName` vem nulo e o vínculo nasce
  // confirmado. O vínculo é global e dura
  // além do evento, então quem decide é o programa ("Confirmar vínculo"
  // ou a lixeira no elenco). Não faz nada se já existe vínculo ativo
  // entre os dois ou se o email é de uma conta Programa. Contas que ainda
  // não existem ficam pendentes e são reclamadas no cadastro, como nas
  // outras duas direções.
  async requestLinkFromEvent(params: {
    programUserId: string | null;
    programEmail: string;
    firstName: string;
    lastName: string;
    email: string;
    // Nulo quando quem cadastra é o próprio programa (inscrição pelo
    // programa): aí o vínculo já nasce confirmado, como em `create`.
    eventName: string | null;
    createdById: string;
  }): Promise<void> {
    const email = params.email.trim();
    const programUser = params.programUserId
      ? await this.usersService.findById(params.programUserId)
      : await this.usersService.findByEmailInsensitive(params.programEmail);
    const programUserId =
      programUser?.role === UserRole.PROGRAM ? programUser.id : null;
    const programEmail = programUserId
      ? (programUser as NonNullable<typeof programUser>).email
      : params.programEmail.trim();

    const athleteUser = await this.usersService.findByEmailInsensitive(email);
    if (athleteUser?.role === UserRole.PROGRAM) return;
    const athleteUserId = athleteUser?.id ?? null;

    const query = this.linksRepo
      .createQueryBuilder('link')
      .where('link.endedAt IS NULL')
      .andWhere(
        programUserId
          ? '(link.programUserId = :programUserId OR LOWER(link.programEmail) = LOWER(:programEmail))'
          : 'LOWER(link.programEmail) = LOWER(:programEmail)',
        { programUserId, programEmail },
      )
      .andWhere(
        athleteUserId
          ? '(link.athleteUserId = :athleteUserId OR LOWER(link.email) = LOWER(:email))'
          : 'LOWER(link.email) = LOWER(:email)',
        { athleteUserId, email },
      );
    if (await query.getExists()) return;

    const saved = await this.linksRepo.save(
      this.linksRepo.create({
        programUserId,
        programEmail,
        athleteUserId,
        firstName: athleteUser?.firstName ?? params.firstName,
        lastName: athleteUser?.lastName ?? params.lastName,
        email: athleteUser?.email ?? email,
        confirmedAt: params.eventName === null ? new Date() : null,
        requestedFromEvent: params.eventName?.slice(0, 200) ?? null,
        createdById: params.createdById,
      }),
    );
    if (programUserId && athleteUserId) {
      await this.syncEventAccessForLink(saved);
    }
  }

  async listMyPrograms(athleteUserId: string): Promise<AthleteLinkView[]> {
    const links = await this.linksRepo.find({
      where: { athleteUserId, endedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return links.map((l) => this.toView(l));
  }

  // Chamado por AuthService (cadastro e login) pra qualquer conta menos
  // Programa — reclama convites que um PROGRAMA já tinha criado (por
  // email) antes da pessoa ter conta. O login cobre convites criados
  // antes de contas Jurado/Organização poderem ser atletas, que ficaram
  // pendentes mesmo com a conta existindo.
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

  // Usado por ScoringService (visão do atleta nas Súmulas) — a quais
  // programas (userId) este atleta tem vínculo CONFIRMADO valendo pra um
  // evento. Vínculo encerrado só vale se o evento já tinha começado
  // quando o atleta saiu (`eventStartedAt <= endedAt`): mantém o
  // histórico sem dar acesso a evento posterior.
  async getConfirmedProgramUserIds(
    athleteUserId: string,
    eventStartedAt: Date | null,
  ): Promise<string[]> {
    const links = await this.linksRepo.find({
      where: { athleteUserId, confirmedAt: Not(IsNull()) },
    });
    const ids = links
      .filter(
        (l) =>
          l.endedAt === null ||
          (eventStartedAt !== null && eventStartedAt <= l.endedAt),
      )
      .map((l) => l.programUserId)
      .filter((id): id is string => id !== null);
    return [...new Set(ids)];
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

  // Inverso de syncEventAccessForLink — chamado ao encerrar um vínculo
  // (de qualquer lado, ver endLink). Tira ATHLETE dos eventos desse
  // programa que ainda NÃO começaram (criado/publicado); nos iniciados e
  // concluídos o papel fica, pra manter o histórico. Não deixa a pessoa
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
      const event = await this.eventsService
        .findEventOrThrow(aliasId)
        .catch(() => null);
      if (
        !event ||
        event.status === EventStatus.STARTED ||
        event.status === EventStatus.COMPLETED
      ) {
        continue;
      }
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
      where: { programUserId, athleteUserId: Not(IsNull()), endedAt: IsNull() },
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

  private toView(
    link: AthleteLink,
    emailIsProgramAccount = false,
  ): AthleteLinkView {
    return {
      id: link.id,
      firstName: link.firstName ?? '',
      lastName: link.lastName ?? '',
      email: link.email ?? '',
      programEmail: link.programEmail,
      hasAccount: link.athleteUserId !== null,
      programResolved: link.programUserId !== null,
      confirmed: link.confirmedAt !== null,
      emailIsProgramAccount,
      requestedFromEvent: link.requestedFromEvent,
      createdAt: link.createdAt.toISOString(),
    };
  }
}

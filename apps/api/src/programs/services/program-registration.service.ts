import { RegulationsService } from '../../regulations/services/regulations.service';
import { RegulationDocument } from '../../regulations/entities/regulation-document.entity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { ProgramParticipation } from '../entities/program-participation.entity';
import { ProgramAthlete } from '../entities/program-athlete.entity';
import { TeamCategoryAthlete } from '../entities/team-category-athlete.entity';
import { Team } from '../../teams/entities/team.entity';
import { Category } from '../../categories/entities/category.entity';
import { CategoryCriteriaService } from '../../categories/services/category-criteria.service';
import { RegistrationSettingsService } from './registration-settings.service';
import { AthleteRequirementValue } from '../entities/athlete-requirement-value.entity';
import { AthleteRequirementDocument } from '../../documents/entities/athlete-requirement-document.entity';
import { AthleteLink } from '../../athletes/entities/athlete-link.entity';
import { requirementApplies } from '../registration-requirements';
import type { CategoryRules } from '../../categories/entities/category.entity';
import type { CategoryCriterion } from '../../categories/category-criteria';
import { CategoryStatus } from '../../categories/enums/category-status.enum';
import { Event } from '../../events/entities/event.entity';
import { EventsService } from '../../events/services/events.service';
import { isRegistrationOpen } from '../../events/registration-window';
import { UsersService } from '../../users/services/users.service';
import {
  AthletesService,
  type AthleteLinkView,
} from '../../athletes/services/athletes.service';
import { ProgramsService } from './programs.service';
import { ProgramAthletesService } from './program-athletes.service';
import { RegisterProgramDto } from '../dto/register-program.dto';
import {
  RegistrationRequest,
  RegistrationRequestType,
} from '../entities/registration-request.entity';
import {
  programCanEditRegistration,
  programCanRequestChange,
  REGISTRATION_LOCKED_MESSAGE,
} from '../registration-edit';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/enums/notification-type.enum';
import { NotificationAudience } from '../../notifications/enums/notification-audience.enum';
import { MailService } from '../../auth/services/mail.service';
import { AthleteEntryDto } from '../dto/set-athlete-entries.dto';

export interface RegistrationRequestView {
  id: string;
  type: RegistrationRequestType;
  message: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface ProgramRegistrationView {
  event: {
    id: string;
    name: string;
    startDate: string;
    competitionDays: number;
    location: string;
    venue: string | null;
    logoUrl: string | null;
    status: string;
    registrationDeadline: string | null;
  };
  open: boolean;
  // Inscrição deste programa no evento (com equipes e categorias), ou
  // null se ainda não começou (nasce na primeira equipe adicionada).
  program: ProgramParticipation | null;
  profile: {
    name: string;
    email: string;
    city: string | null;
    state: string | null;
    logoUrl: string | null;
  };
  categories: Category[];
  // Critérios de divisão do evento (filtros da ficha, na ordem e com as
  // opções configuradas pelo produtor).
  categoryCriteria: CategoryCriterion[];
  // O que impede o envio pelas regras das categorias (número de atletas e
  // idade). A tela mostra antes; o envio recusa com a mesma lista.
  issues: RegistrationIssue[];
  // Data de nascimento de cada atleta do elenco (id do vínculo -> data ou
  // null), ver birthDateLookup. Usada pra separar os elegíveis por idade
  // ao escolher atletas de uma categoria.
  rosterBirthDates: Record<string, string | null>;
  // Nomes de equipes usadas em inscrições anteriores do programa que
  // ainda não estão nesta (atalhos pra reaproveitar).
  previousTeamNames: string[];
  // Pode mexer na ficha agora (ver programCanEditRegistration).
  canEdit: boolean;
  // Pode mandar pedido de alteração/cancelamento ao organizador.
  canRequest: boolean;
  requests: RegistrationRequestView[];
  // Documentos enviados na etapa Regulamento do Setup (regulamento,
  // segurança, conduta, adicionais), pra consulta durante a inscrição.
  regulationDocuments: RegulationDocument[];
}

export interface RegistrationIssue {
  kind:
    | 'athletes_count'
    | 'age'
    | 'missing_birth_date'
    | 'missing_requirement'
    | 'missing_document';
  teamId: string;
  categoryId: string;
  // Atleta do evento (ProgramAthlete), nos problemas de idade e de dados.
  athleteId: string | null;
  // Vínculo do elenco, pra informar a data de nascimento que falta.
  linkId: string | null;
  // Item pedido na inscrição que falta (missing_requirement).
  requirementId: string | null;
  // Impede o envio. Só documentos podem não impedir (quando o produtor
  // permite enviar sem todos os documentos); dados sempre impedem.
  blocking: boolean;
  message: string;
}

const brDate = (iso: string) => iso.split('-').reverse().join('/');

// "16 a 24 atletas", "até 17 anos", "10 anos ou mais".
function rangeText(
  min: number | null,
  max: number | null,
  unit: string,
): string {
  if (min != null && max != null) return `de ${min} a ${max} ${unit}`;
  if (min != null) return `${min} ${unit} ou mais`;
  return `até ${max} ${unit}`;
}

// Idade completa na data (aniversário na própria data conta).
function ageAt(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = onDate.split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

// Motivo de um atleta não poder entrar numa categoria pela regra de
// idade; null = elegível (ou categoria sem regra de idade). Mesmas
// mensagens da tela (EventRegistrationPage, popup de atletas).
function ageProblem(
  rules: CategoryRules,
  birthDate: string | null,
): string | null {
  if ((rules.minAge == null && rules.maxAge == null) || !rules.ageCutoffDate) {
    return null;
  }
  if (!birthDate) return 'Data de nascimento obrigatória para a categoria.';
  const age = ageAt(birthDate, rules.ageCutoffDate);
  if (rules.minAge != null && age < rules.minAge) {
    return `Não tem a idade mínima (${rules.minAge} anos).`;
  }
  if (rules.maxAge != null && age > rules.maxAge) {
    return `Idade superior ao máximo permitido (${rules.maxAge} anos).`;
  }
  return null;
}

// Inscrição de um evento feita pela própria conta Programa (2026-10-05).
// Uma tela só: equipes (rotas de sempre, liberadas pro dono pelo
// ProgramAccessGuard) e, por equipe+categoria, os atletas escolhidos do
// ELENCO do programa (AthleteLink confirmado). Só o atleta marcado em
// alguma categoria vira ProgramAthlete do evento; desmarcado de tudo, sai.
// Não passa pelo EventMemberGuard: o evento pode estar em rascunho. Exige
// algum vínculo com o evento (ex.: entrou pelo código/QR).
@Injectable()
export class ProgramRegistrationService {
  constructor(
    @InjectRepository(ProgramParticipation)
    private readonly participationsRepo: Repository<ProgramParticipation>,
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    @InjectRepository(Team)
    private readonly teamsRepo: Repository<Team>,
    @InjectRepository(ProgramAthlete)
    private readonly athletesRepo: Repository<ProgramAthlete>,
    @InjectRepository(TeamCategoryAthlete)
    private readonly entriesRepo: Repository<TeamCategoryAthlete>,
    @InjectRepository(RegistrationRequest)
    private readonly requestsRepo: Repository<RegistrationRequest>,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly eventsService: EventsService,
    private readonly programsService: ProgramsService,
    private readonly programAthletesService: ProgramAthletesService,
    private readonly athletesService: AthletesService,
    private readonly usersService: UsersService,
    private readonly categoryCriteriaService: CategoryCriteriaService,
    private readonly registrationSettingsService: RegistrationSettingsService,
    @InjectRepository(AthleteRequirementValue)
    private readonly requirementValuesRepo: Repository<AthleteRequirementValue>,
    @InjectRepository(AthleteRequirementDocument)
    private readonly requirementDocumentsRepo: Repository<AthleteRequirementDocument>,
    @InjectRepository(AthleteLink)
    private readonly linksRepo: Repository<AthleteLink>,
    private readonly dataSource: DataSource,
    private readonly regulationsService: RegulationsService,
  ) {}

  async get(eventId: string, userId: string): Promise<ProgramRegistrationView> {
    const { event, participation } = await this.loadForUser(eventId, userId);
    const { profile } = await this.programsService.findAllForUser(userId);
    const categories = await this.categoriesRepo.find({
      where: { aliasId: event.aliasId, status: CategoryStatus.ACTIVE },
      order: { name: 'ASC' },
    });
    const categoryCriteria = await this.categoryCriteriaService.getByAlias(
      event.aliasId,
    );
    this.categoryCriteriaService.attachLabels(categories, categoryCriteria);
    const issues = participation
      ? await this.computeIssues(event, participation.id)
      : [];
    const program = participation
      ? await this.programsService.findOneForEvent(eventId, participation.id)
      : null;
    const rosterBirthDates = await this.rosterBirthDates(
      userId,
      participation?.id ?? null,
    );
    return {
      event: {
        id: event.aliasId,
        name: event.name,
        startDate: event.startDate,
        competitionDays: event.competitionDays,
        location: event.location,
        venue: event.venue,
        logoUrl: event.logoUrl,
        status: event.status,
        registrationDeadline: event.registrationDeadline,
      },
      open: isRegistrationOpen(event),
      program,
      profile: {
        name: profile.name,
        email: profile.contactEmail,
        city: profile.city,
        state: profile.state,
        logoUrl: profile.logoUrl,
      },
      categories,
      categoryCriteria,
      issues,
      rosterBirthDates,
      previousTeamNames: await this.previousTeamNames(
        userId,
        event.aliasId,
        program?.teams.map((t) => t.name) ?? [],
      ),
      canEdit: participation
        ? programCanEditRegistration(event, participation)
        : isRegistrationOpen(event),
      canRequest: participation
        ? programCanRequestChange(event, participation)
        : false,
      requests: participation
        ? (
            await this.requestsRepo.find({
              where: { programId: participation.id },
              order: { createdAt: 'DESC' },
            })
          ).map((r) => this.toRequestView(r))
        : [],
      regulationDocuments: await this.regulationsService.listDocumentsByAlias(
        event.aliasId,
      ),
    };
  }

  // Cria a inscrição (se ainda não existe) com os dados do perfil. Os
  // campos opcionais corrigem o perfil antes (conta sem cidade/UF).
  async register(
    eventId: string,
    userId: string,
    dto: RegisterProgramDto,
  ): Promise<ProgramRegistrationView> {
    const { event, participation } = await this.loadForUser(eventId, userId);
    if (participation) this.assertCanEdit(event, participation);
    else this.assertOpen(event);
    const changes = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.city !== undefined && { city: dto.city.trim() }),
      ...(dto.state !== undefined && { state: dto.state.trim().toUpperCase() }),
    };
    const profile = Object.keys(changes).length
      ? await this.programsService.updateOwnProfile(userId, changes)
      : (await this.programsService.findAllForUser(userId)).profile;
    if (!profile.city || !profile.state) {
      throw new BadRequestException(
        'Informe a cidade e a UF do programa antes de se inscrever.',
      );
    }
    const data = {
      name: profile.name,
      city: profile.city,
      state: profile.state,
    };

    if (participation) {
      Object.assign(participation, data);
      await this.participationsRepo.save(participation);
    } else {
      const user = await this.usersService.findById(userId);
      if (!user) throw new NotFoundException('Usuário não encontrado');
      await this.programsService.create(
        eventId,
        { ...data, email: profile.contactEmail || user.email, userId },
        userId,
        { draft: true },
      );
    }
    return this.get(eventId, userId);
  }

  // "Enviar inscrição": tira do rascunho (passa a aparecer pro produtor,
  // ganha o papel PROGRAM). Exige ao menos uma equipe numa categoria.
  // Depois de enviada, continua editável até o prazo.
  async submit(
    eventId: string,
    userId: string,
  ): Promise<ProgramRegistrationView> {
    const { participation } = await this.loadOwnedOpen(eventId, userId);
    const withCategory = await this.teamsRepo
      .createQueryBuilder('team')
      .innerJoin('team.categories', 'category')
      .where('team.programId = :programId', { programId: participation.id })
      .getCount();
    if (withCategory === 0) {
      throw new BadRequestException(
        'Coloque ao menos uma equipe em uma categoria antes de enviar a inscrição.',
      );
    }
    // Toda equipe precisa de atletas em cada categoria em que está
    // (decisão do usuário, 2026-10-05).
    const pending: { team: string; category: string }[] = await this.teamsRepo
      .createQueryBuilder('team')
      .innerJoin('team.categories', 'category')
      .select('team.name', 'team')
      .addSelect('category.name', 'category')
      .where('team.programId = :programId', { programId: participation.id })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM team_category_athletes e WHERE e.team_id = team.id AND e.category_id = category.id)',
      )
      .getRawMany();
    if (pending.length > 0) {
      throw new BadRequestException(
        `Escolha os atletas antes de enviar: ${pending
          .map((p) => `${p.team} em ${p.category}`)
          .join('; ')}.`,
      );
    }
    // Regras das categorias (número de atletas e idade, 2026-10-06).
    const event = await this.eventsService.findEventOrThrow(eventId);
    const issues = (await this.computeIssues(event, participation.id)).filter(
      (i) => i.blocking,
    );
    if (issues.length > 0) {
      const shown = issues.slice(0, 5).map((i) => i.message);
      const more = issues.length - shown.length;
      throw new BadRequestException(
        `Corrija antes de enviar: ${shown.join(' ')}${more > 0 ? ` E mais ${more}.` : ''}`,
      );
    }
    const resubmit = participation.submittedAt !== null;
    // O programa assumiu a ficha (some a tag "Inscrito pelo organizador").
    participation.submittedBy = userId;
    if (resubmit) {
      // Ficha devolvida pelo organizador e enviada de novo: trava outra vez.
      participation.reopenedAt = null;
      await this.participationsRepo.save(participation);
    } else {
      await this.programsService.submitRegistration(participation);
    }
    await this.notificationsService.create(
      participation.aliasId,
      NotificationType.REGISTRATION_SUBMITTED,
      NotificationAudience.MANAGERS,
      resubmit
        ? `${participation.name} reenviou a inscrição`
        : `${participation.name} enviou a inscrição`,
    );
    await this.emailRegistrationSubmitted(eventId, participation.id, resubmit);
    return this.get(eventId, userId);
  }

  // Email da inscrição enviada/reenviada pro dono, admins e assessores,
  // com o resumo da ficha. Melhor esforço (falha de email só vai pro log).
  private async emailRegistrationSubmitted(
    eventId: string,
    programId: string,
    resubmit: boolean,
  ): Promise<void> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const program = await this.programsService.findOneForEvent(
      eventId,
      programId,
    );
    const enrolled = program.teams.filter((t) => t.categories.length > 0);
    const pairs = enrolled.reduce((sum, t) => sum + t.categories.length, 0);
    const plural = (n: number, one: string, many: string) =>
      `${n} ${n === 1 ? one : many}`;
    const verb = resubmit ? 'reenviou' : 'enviou';
    await this.mailService.sendNotice({
      to: await this.eventsService.findManagerEmails(event.aliasId),
      replyTo: program.email,
      subject: `[${event.name}] ${program.name} ${verb} a inscrição`,
      heading: resubmit ? 'Inscrição reenviada' : 'Nova inscrição',
      lines: [
        `O programa ${program.name} (${program.city} - ${program.state}) ${verb} a ficha de inscrição no evento ${event.name}.`,
        `${plural(program.athletesCount ?? 0, 'atleta', 'atletas')}, ${plural(enrolled.length, 'equipe', 'equipes')} em ${plural(pairs, 'categoria', 'categorias')}:`,
      ],
      // Uma linha por equipe, com quantos atletas em cada categoria.
      message: enrolled
        .map(
          (t) =>
            `${t.name}: ${t.categories
              .map(
                (c) =>
                  `${c.name} (${plural((c as { athletesCount?: number }).athletesCount ?? 0, 'atleta', 'atletas')})`,
              )
              .join(', ')}`,
        )
        .join('\n'),
      actionPath: `/events/${event.aliasId}/programs/${programId}`,
      actionLabel: 'Ver a inscrição',
      event: { name: event.name, logoUrl: event.logoUrl },
    });
  }

  // Pedido de alteração ou cancelamento ao organizador (ficha travada).
  // Notifica admin/assessor na plataforma e por email.
  async createRequest(
    eventId: string,
    userId: string,
    type: RegistrationRequestType,
    message: string,
  ): Promise<ProgramRegistrationView> {
    const { event, participation } = await this.loadForUser(eventId, userId);
    if (!participation || !programCanRequestChange(event, participation)) {
      throw new ConflictException(
        'Só dá pra enviar pedidos depois de enviar a inscrição e antes de o evento começar.',
      );
    }
    const text = message.trim();
    await this.requestsRepo.save(
      this.requestsRepo.create({
        aliasId: event.aliasId,
        programId: participation.id,
        type,
        message: text,
        createdById: userId,
      }),
    );
    const program = await this.programsService.findOneForEvent(
      eventId,
      participation.id,
    );
    const what =
      type === RegistrationRequestType.CANCEL ? 'cancelamento' : 'alteração';
    await this.notificationsService.create(
      event.aliasId,
      NotificationType.REGISTRATION_REQUEST,
      NotificationAudience.MANAGERS,
      `${program.name} pediu ${what} da inscrição`,
    );
    await this.mailService.sendNotice({
      to: await this.eventsService.findManagerEmails(event.aliasId),
      replyTo: program.email,
      subject: `[${event.name}] ${program.name} pediu ${what} da inscrição`,
      heading:
        type === RegistrationRequestType.CANCEL
          ? 'Pedido de cancelamento'
          : 'Pedido de alteração',
      lines: [
        `O programa ${program.name} (${program.email}) pediu ${what} da inscrição no evento ${event.name}.`,
        text ? 'Mensagem do programa:' : 'O programa não deixou mensagem.',
      ],
      message: text || undefined,
      event: { name: event.name, logoUrl: event.logoUrl },
      actionPath: `/events/${event.aliasId}/programs/${participation.id}`,
      actionLabel: 'Ver o programa',
    });
    return this.get(eventId, userId);
  }

  // --- Lado do organizador (ProgramRegistrationAdminController) ---

  // Aba "Solicitações" da tela de Programas: pedidos de todos os
  // programas do evento (pendentes primeiro), com o que a tela precisa do
  // programa pra mostrar e pra "Liberar edição".
  async listEventRequests(eventId: string): Promise<
    (RegistrationRequestView & {
      program: {
        id: string;
        name: string;
        submittedAt: Date | null;
        reopenedAt: Date | null;
        selfRegistered: boolean;
      };
    })[]
  > {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const rows = await this.requestsRepo.find({
      where: { aliasId: event.aliasId },
      relations: ['program'],
    });
    const views = await Promise.all(
      rows.map(async (r) => {
        const program = await this.programsService.findOneForEvent(
          eventId,
          r.programId,
        );
        return {
          ...this.toRequestView(r),
          program: {
            id: program.id,
            name: program.name,
            submittedAt: r.program.submittedAt,
            reopenedAt: r.program.reopenedAt,
            selfRegistered:
              r.program.userId !== null &&
              r.program.userId === r.program.createdById,
          },
        };
      }),
    );
    return views.sort(
      (a, b) =>
        Number(a.resolvedAt !== null) - Number(b.resolvedAt !== null) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async listRequests(
    eventId: string,
    programId: string,
  ): Promise<RegistrationRequestView[]> {
    await this.programsService.findProgramOrThrow(eventId, programId);
    const rows = await this.requestsRepo.find({
      where: { programId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toRequestView(r));
  }

  async resolveRequest(
    eventId: string,
    programId: string,
    requestId: string,
    userId: string,
  ): Promise<RegistrationRequestView> {
    await this.programsService.findProgramOrThrow(eventId, programId);
    const request = await this.requestsRepo.findOneBy({
      id: requestId,
      programId,
    });
    if (!request) throw new NotFoundException('Pedido não encontrado');
    if (!request.resolvedAt) {
      request.resolvedAt = new Date();
      request.resolvedById = userId;
      await this.requestsRepo.save(request);
    }
    return this.toRequestView(request);
  }

  // "Aceitar cancelamento" (pedido de cancelamento pendente): avisa o
  // programa por email e exclui o programa do evento, com equipes,
  // atletas e apresentações (ProgramsService.remove tira as apresentações
  // pelo cronograma). O pedido some junto (FK CASCADE).
  async acceptCancel(
    eventId: string,
    programId: string,
    requestId: string,
    userId: string,
  ): Promise<void> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const request = await this.requestsRepo.findOneBy({
      id: requestId,
      programId,
    });
    if (!request) throw new NotFoundException('Pedido não encontrado');
    if (request.type !== RegistrationRequestType.CANCEL || request.resolvedAt) {
      throw new ConflictException(
        'Só dá pra aceitar um pedido de cancelamento pendente.',
      );
    }
    const program = await this.programsService.findOneForEvent(
      eventId,
      programId,
    );
    await this.programsService.remove(eventId, programId, userId);
    await this.mailService.sendNotice({
      to: [program.email],
      subject: `[${event.name}] Inscrição cancelada`,
      heading: 'Inscrição cancelada',
      lines: [
        `O organizador do evento ${event.name} aceitou o pedido de cancelamento da inscrição do ${program.name}.`,
        'As equipes e atletas inscritos foram retirados do evento.',
      ],
      event: { name: event.name, logoUrl: event.logoUrl },
    });
  }

  // "Liberar edição": devolve a ficha enviada pro programa editar (até o
  // evento iniciar); ela trava de novo quando o programa reenviar.
  async reopen(
    eventId: string,
    programId: string,
  ): Promise<ProgramParticipation> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const participation = await this.programsService.findProgramOrThrow(
      eventId,
      programId,
    );
    if (!participation.userId || !participation.submittedAt) {
      throw new ConflictException(
        'Este programa não tem uma inscrição enviada pela própria conta.',
      );
    }
    if (!programCanRequestChange(event, participation)) {
      throw new ConflictException(
        'Não dá pra liberar a edição depois que o evento começou.',
      );
    }
    if (!participation.reopenedAt) {
      participation.reopenedAt = new Date();
      await this.participationsRepo.save(participation);
      // Notificação só pro programa (destinatário único).
      await this.notificationsService.create(
        event.aliasId,
        NotificationType.REGISTRATION_REOPENED,
        NotificationAudience.ALL,
        'O organizador liberou sua ficha de inscrição para edição',
        undefined,
        participation.userId,
      );
      const program = await this.programsService.findOneForEvent(
        eventId,
        programId,
      );
      await this.mailService.sendNotice({
        to: [program.email],
        subject: `[${event.name}] Sua ficha de inscrição foi liberada para edição`,
        heading: 'Ficha liberada para edição',
        lines: [
          `O organizador do evento ${event.name} liberou a ficha de inscrição do ${program.name} para edição.`,
          'Faça as mudanças e envie a inscrição de novo.',
        ],
        actionPath: `/events/${event.aliasId}/registration`,
        actionLabel: 'Abrir a inscrição',
        event: { name: event.name, logoUrl: event.logoUrl },
      });
    }
    return this.programsService.findOneForEvent(eventId, programId);
  }

  private toRequestView(r: RegistrationRequest): RegistrationRequestView {
    return {
      id: r.id,
      type: r.type,
      message: r.message,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
    };
  }

  // Popup da equipe: categorias marcadas (substitui a lista).
  async setTeamCategories(
    eventId: string,
    userId: string,
    teamId: string,
    categoryIds: string[],
  ): Promise<ProgramRegistrationView> {
    const { event, participation } = await this.loadOwnedOpen(eventId, userId);
    const team = await this.findOwnTeam(participation, teamId);
    const wanted = [...new Set(categoryIds)];
    await this.assertEventCategories(event, wanted);
    const current = team.categories.map((c) => c.id);
    const toAdd = wanted.filter((id) => !current.includes(id));
    const toRemove = current.filter((id) => !wanted.includes(id));
    const relation = this.teamsRepo
      .createQueryBuilder()
      .relation(Team, 'categories')
      .of(team.id);
    if (toAdd.length) await relation.add(toAdd);
    if (toRemove.length) {
      await relation.remove(toRemove);
      await this.entriesRepo.delete({
        teamId: team.id,
        categoryId: In(toRemove),
      });
    }
    await this.removeUnassignedRosterAthletes(participation, userId);
    return this.get(eventId, userId);
  }

  // Arrastar a equipe de uma categoria pra outra: ela sai da primeira,
  // entra na segunda e os atletas marcados vão junto (2026-10-05).
  async moveTeamCategory(
    eventId: string,
    userId: string,
    teamId: string,
    fromCategoryId: string,
    toCategoryId: string,
  ): Promise<ProgramRegistrationView> {
    const { event, participation } = await this.loadOwnedOpen(eventId, userId);
    const team = await this.findOwnTeam(participation, teamId);
    if (!team.categories.some((c) => c.id === fromCategoryId)) {
      throw new NotFoundException('A equipe não está nessa categoria.');
    }
    if (team.categories.some((c) => c.id === toCategoryId)) {
      throw new ConflictException('A equipe já está na categoria de destino.');
    }
    await this.assertEventCategories(event, [toCategoryId]);
    // Idade fora da regra da categoria nova não impede (2026-10-06): vira
    // pendência que barra o envio (computeIssues), como o nº de atletas.
    await this.dataSource.transaction(async (manager) => {
      const relation = manager
        .createQueryBuilder()
        .relation(Team, 'categories')
        .of(team.id);
      await relation.add(toCategoryId);
      await manager.update(
        TeamCategoryAthlete,
        { teamId: team.id, categoryId: fromCategoryId },
        { categoryId: toCategoryId },
      );
      await relation.remove(fromCategoryId);
    });
    return this.get(eventId, userId);
  }

  // Popup de atletas de uma equipe numa categoria (soltar a equipe na
  // categoria ou clicar nela dentro da categoria). Inscreve a equipe na
  // categoria se ainda não estava.
  async setPairAthletes(
    eventId: string,
    userId: string,
    teamId: string,
    categoryId: string,
    linkIds: string[],
  ): Promise<ProgramRegistrationView> {
    const { event, participation } = await this.loadOwnedOpen(eventId, userId);
    const team = await this.findOwnTeam(participation, teamId);
    await this.assertEventCategories(event, [categoryId]);
    if (!team.categories.some((c) => c.id === categoryId)) {
      await this.teamsRepo
        .createQueryBuilder()
        .relation(Team, 'categories')
        .of(team.id)
        .add(categoryId);
    }
    const athleteIds = await this.athleteIdsForLinks(
      eventId,
      participation,
      userId,
      linkIds,
    );
    await this.programAthletesService.setTeamCategoryAthletes(
      eventId,
      participation.id,
      team.id,
      categoryId,
      athleteIds,
    );
    await this.removeUnassignedRosterAthletes(participation, userId);
    return this.get(eventId, userId);
  }

  // Aba Atletas: equipe+categoria de um atleta do elenco (substitui).
  async setAthleteEntries(
    eventId: string,
    userId: string,
    linkId: string,
    entries: AthleteEntryDto[],
  ): Promise<ProgramRegistrationView> {
    const { participation } = await this.loadOwnedOpen(eventId, userId);
    const [athleteId] = await this.athleteIdsForLinks(
      eventId,
      participation,
      userId,
      [linkId],
    );
    await this.programAthletesService.setAthleteEntries(
      eventId,
      participation.id,
      athleteId,
      entries,
    );
    await this.removeUnassignedRosterAthletes(participation, userId);
    return this.get(eventId, userId);
  }

  private async loadForUser(
    eventId: string,
    userId: string,
  ): Promise<{ event: Event; participation: ProgramParticipation | null }> {
    const { event, member } = await this.eventsService.getMemberForEventId(
      eventId,
      userId,
    );
    const participation = await this.participationsRepo.findOneBy({
      aliasId: event.aliasId,
      userId,
    });
    if (!member && !participation) {
      throw new ForbiddenException(
        'Entre no evento pelo link ou código antes de se inscrever.',
      );
    }
    return { event, participation };
  }

  private async loadOwnedOpen(
    eventId: string,
    userId: string,
  ): Promise<{ event: Event; participation: ProgramParticipation }> {
    const { event, participation } = await this.loadForUser(eventId, userId);
    if (!participation) {
      this.assertOpen(event);
      throw new NotFoundException(
        'Adicione uma equipe para começar a inscrição.',
      );
    }
    this.assertCanEdit(event, participation);
    return { event, participation };
  }

  private assertCanEdit(
    event: Event,
    participation: ProgramParticipation,
  ): void {
    if (programCanEditRegistration(event, participation)) return;
    throw new ConflictException(
      participation.submittedAt && isRegistrationOpen(event)
        ? REGISTRATION_LOCKED_MESSAGE
        : 'As inscrições deste evento estão encerradas.',
    );
  }

  private assertOpen(event: Event): void {
    if (!isRegistrationOpen(event)) {
      throw new ConflictException(
        'As inscrições deste evento estão encerradas.',
      );
    }
  }

  private async findOwnTeam(
    participation: ProgramParticipation,
    teamId: string,
  ): Promise<Team> {
    const team = await this.teamsRepo.findOne({
      where: { id: teamId, programId: participation.id },
      relations: ['categories'],
    });
    if (!team) throw new NotFoundException('Equipe não encontrada');
    return team;
  }

  private async assertEventCategories(
    event: Event,
    ids: string[],
  ): Promise<void> {
    if (ids.length === 0) return;
    const count = await this.categoriesRepo.count({
      where: {
        id: In(ids),
        aliasId: event.aliasId,
        status: CategoryStatus.ACTIVE,
      },
    });
    if (count !== ids.length)
      throw new NotFoundException('Categoria não encontrada');
  }

  // Elenco usável na inscrição: vínculos confirmados (o programa já
  // aceitou) com email.
  private async roster(userId: string): Promise<AthleteLinkView[]> {
    const links = await this.athletesService.listForProgram(userId);
    return links.filter(
      (l) => l.confirmed && !l.emailIsProgramAccount && l.email,
    );
  }

  // Vínculos do elenco -> atletas do evento (ProgramAthlete), criando os
  // que faltam. Casamento por email (único dentro do programa).
  private async athleteIdsForLinks(
    eventId: string,
    participation: ProgramParticipation,
    userId: string,
    linkIds: string[],
  ): Promise<string[]> {
    const roster = await this.roster(userId);
    const byId = new Map(roster.map((l) => [l.id, l]));
    const links = [...new Set(linkIds)].map((id) => {
      const link = byId.get(id);
      if (!link)
        throw new NotFoundException('Atleta não encontrado no seu elenco.');
      return link;
    });
    const existing = await this.athletesRepo.findBy({
      programId: participation.id,
    });
    const byEmail = new Map(existing.map((a) => [a.email.toLowerCase(), a.id]));
    const ids: string[] = [];
    for (const link of links) {
      const email = link.email.toLowerCase();
      let id = byEmail.get(email);
      if (!id) {
        const created = await this.programAthletesService.create(
          eventId,
          participation.id,
          {
            firstName: link.firstName || email,
            lastName: link.lastName,
            email,
          },
          userId,
        );
        id = created.id;
        byEmail.set(email, id);
      }
      ids.push(id);
    }
    return ids;
  }

  // Atleta do elenco que ficou sem nenhuma categoria sai do evento
  // ("só quem está numa categoria participa"). Atleta cadastrado pelo
  // produtor sem vínculo no elenco não é tocado. Também fica quem já
  // mandou dado, documento ou a própria inscrição (o atleta pode fazer
  // isso antes de ter categoria, 2026-10-06): apagar levaria tudo junto.
  private async removeUnassignedRosterAthletes(
    participation: ProgramParticipation,
    userId: string,
  ): Promise<void> {
    const rosterEmails = (await this.roster(userId)).map((l) =>
      l.email.toLowerCase(),
    );
    if (rosterEmails.length === 0) return;
    const orphans: { id: string }[] = await this.athletesRepo
      .createQueryBuilder('a')
      .select('a.id', 'id')
      .where('a.programId = :programId', { programId: participation.id })
      .andWhere('LOWER(a.email) IN (:...emails)', { emails: rosterEmails })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM team_category_athletes e WHERE e.athlete_id = a.id)',
      )
      .andWhere('a.athleteSubmittedAt IS NULL')
      .andWhere('a.cpf IS NULL AND a.birthDate IS NULL')
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM athlete_requirement_values v WHERE v.program_athlete_id = a.id)',
      )
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM athlete_requirement_documents d WHERE d.program_athlete_id = a.id)',
      )
      .getRawMany();
    if (orphans.length) {
      await this.athletesRepo.delete({ id: In(orphans.map((o) => o.id)) });
    }
  }

  private async rosterBirthDates(
    userId: string,
    participationId: string | null,
  ): Promise<Record<string, string | null>> {
    const roster = await this.roster(userId);
    if (roster.length === 0) return {};
    const { birthDateOf } = await this.birthDateLookup(userId, participationId);
    return Object.fromEntries(roster.map((l) => [l.id, birthDateOf(l.email)]));
  }

  // Data de nascimento de um atleta (por email), uma só por atleta
  // (decisão do usuário, 2026-10-06): a da conta dele, se existir; senão
  // a informada pelo programa no elenco; senão a do atleta do evento
  // (cadastro do produtor no Setup).
  private async birthDateLookup(
    userId: string,
    participationId: string | null,
  ): Promise<{
    birthDateOf: (email: string) => string | null;
    linkIdOf: (email: string) => string | null;
  }> {
    const roster = await this.roster(userId);
    const eventAthletes = participationId
      ? await this.athletesRepo.findBy({ programId: participationId })
      : [];
    const eventDates = new Map(
      eventAthletes
        .filter((a) => a.birthDate)
        .map((a) => [a.email.toLowerCase(), a.birthDate as string]),
    );
    const linkDates = new Map(
      roster
        .filter((l) => l.birthDate)
        .map((l) => [l.email.toLowerCase(), l.birthDate as string]),
    );
    const linkIds = new Map(roster.map((l) => [l.email.toLowerCase(), l.id]));
    const accountDates = await this.usersService.findBirthDatesByEmails([
      ...new Set([
        ...roster.map((l) => l.email.toLowerCase()),
        ...eventAthletes.map((a) => a.email.toLowerCase()),
      ]),
    ]);
    return {
      birthDateOf: (email) => {
        const key = email.toLowerCase();
        return (
          accountDates.get(key) ??
          linkDates.get(key) ??
          eventDates.get(key) ??
          null
        );
      },
      linkIdOf: (email) => linkIds.get(email.toLowerCase()) ?? null,
    };
  }

  // Problemas da ficha pelas regras das categorias (ver
  // CategoryCriteriaService.rulesFor) e dos dados pedidos na inscrição.
  private async computeIssues(
    event: Event,
    participationId: string,
  ): Promise<RegistrationIssue[]> {
    const participation = await this.participationsRepo.findOneByOrFail({
      id: participationId,
    });
    const result = await this.computeIssuesBatch(event, [participation]);
    return result.get(participationId)?.issues ?? [];
  }

  // Pendências de todas as fichas do evento (aba Inscrições do produtor),
  // inclusive rascunhos.
  async issuesForEvent(
    eventId: string,
  ): Promise<
    Record<
      string,
      { issues: RegistrationIssue[]; documentsPendingCount: number }
    >
  > {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const participations = await this.participationsRepo.findBy({
      aliasId: event.aliasId,
    });
    return Object.fromEntries(
      await this.computeIssuesBatch(event, participations),
    );
  }

  // Pendências de uma ficha (aba Pendências da tela do programa).
  async issuesForProgram(
    eventId: string,
    programId: string,
  ): Promise<{ issues: RegistrationIssue[]; documentsPendingCount: number }> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const participation = await this.participationsRepo.findOneBy({
      id: programId,
      aliasId: event.aliasId,
    });
    if (!participation) throw new NotFoundException('Programa não encontrado');
    const result = await this.computeIssuesBatch(event, [participation]);
    return result.get(programId) ?? { issues: [], documentsPendingCount: 0 };
  }

  // Cálculo em lote (uma carga de dados pro evento, não por ficha: cada
  // consulta custa ~45 ms em produção):
  // - equipe+categoria com número de atletas fora do intervalo;
  // - atleta fora da faixa de idade ou sem data de nascimento (data única
  //   do atleta: conta, elenco do programa ou atleta do evento);
  // - dados obrigatórios pedidos na inscrição que faltam (sempre impedem
  //   o envio);
  // - documentos obrigatórios que faltam ou foram contestados
  //   (`missing_document`, contados em `documentsPendingCount`): impedem o
  //   envio, salvo se o produtor permitir (allowSubmitWithoutDocuments),
  //   quando viram aviso.
  // Equipe sem nenhum atleta não entra (já barrada como "escolha os atletas").
  private async computeIssuesBatch(
    event: Event,
    participations: ProgramParticipation[],
  ): Promise<
    Map<string, { issues: RegistrationIssue[]; documentsPendingCount: number }>
  > {
    const result = new Map<
      string,
      { issues: RegistrationIssue[]; documentsPendingCount: number }
    >();
    if (participations.length === 0) return result;
    const programIds = participations.map((p) => p.id);

    const teams = await this.teamsRepo.find({
      where: { programId: In(programIds) },
      relations: ['categories'],
      order: { name: 'ASC' },
    });
    const entries = teams.length
      ? await this.entriesRepo.find({
          where: { teamId: In(teams.map((t) => t.id)) },
        })
      : [];
    const athletes = await this.athletesRepo.findBy({
      programId: In(programIds),
    });
    const athleteById = new Map(athletes.map((a) => [a.id, a]));
    const criteria = await this.categoryCriteriaService.getByAlias(
      event.aliasId,
    );
    const settings = await this.registrationSettingsService.getByAlias(
      event.aliasId,
    );
    const requiredData = settings.requirements.filter(
      (r) => r.required && r.kind !== 'document',
    );
    const requiredDocuments = settings.requirements.filter(
      (r) => r.required && r.kind === 'document',
    );
    const values = athletes.length
      ? await this.requirementValuesRepo.findBy({
          programAthleteId: In(athletes.map((a) => a.id)),
        })
      : [];
    const documents =
      athletes.length && requiredDocuments.length
        ? await this.requirementDocumentsRepo.findBy({
            programAthleteId: In(athletes.map((a) => a.id)),
          })
        : [];
    const emails = [...new Set(athletes.map((a) => a.email.toLowerCase()))];
    const accountDates = await this.usersService.findBirthDatesByEmails(emails);
    const accountCpfs = await this.usersService.findCpfsByEmails(emails);
    // Elenco de cada conta Programa (mesmo critério de roster()).
    const userIds = participations
      .map((p) => p.userId)
      .filter((id): id is string => !!id);
    const links = userIds.length
      ? await this.linksRepo
          .createQueryBuilder('link')
          .where('link.programUserId IN (:...userIds)', { userIds })
          .andWhere('link.endedAt IS NULL')
          .andWhere('link.confirmedAt IS NOT NULL')
          .andWhere('link.email IS NOT NULL')
          .getMany()
      : [];

    for (const participation of participations) {
      const programLinks = links.filter(
        (l) => l.programUserId === participation.userId,
      );
      const linkByEmail = new Map(
        programLinks.map((l) => [(l.email as string).toLowerCase(), l]),
      );
      const programAthletes = athletes.filter(
        (a) => a.programId === participation.id,
      );
      const eventDates = new Map(
        programAthletes
          .filter((a) => a.birthDate)
          .map((a) => [a.email.toLowerCase(), a.birthDate as string]),
      );
      const birthDateOf = (email: string) => {
        const key = email.toLowerCase();
        return (
          accountDates.get(key) ??
          linkByEmail.get(key)?.birthDate ??
          eventDates.get(key) ??
          null
        );
      };
      const linkIdOf = (email: string) =>
        linkByEmail.get(email.toLowerCase())?.id ?? null;

      const programTeams = teams.filter(
        (t) => t.programId === participation.id,
      );
      const pairs = programTeams.flatMap((team) =>
        team.categories.map((category) => ({ team, category })),
      );
      const issues: RegistrationIssue[] = [];
      let documentsPendingCount = 0;

      for (const { team, category } of pairs) {
        const rules = this.categoryCriteriaService.rulesFor(category, criteria);
        const pairAthletes = entries
          .filter((e) => e.teamId === team.id && e.categoryId === category.id)
          .map((e) => athleteById.get(e.athleteId))
          .filter((a): a is ProgramAthlete => !!a);
        if (pairAthletes.length === 0) continue;
        const where = `${team.name} em ${category.name}`;

        const count = pairAthletes.length;
        if (
          (rules.minAthletes != null && count < rules.minAthletes) ||
          (rules.maxAthletes != null && count > rules.maxAthletes)
        ) {
          issues.push({
            kind: 'athletes_count',
            teamId: team.id,
            categoryId: category.id,
            athleteId: null,
            linkId: null,
            requirementId: null,
            blocking: true,
            message: `${where}: ${count} ${count === 1 ? 'atleta' : 'atletas'}, a categoria aceita ${rangeText(rules.minAthletes, rules.maxAthletes, 'atletas')}.`,
          });
        }

        for (const athlete of pairAthletes) {
          const name = `${athlete.firstName} ${athlete.lastName}`.trim();
          const birthDate = birthDateOf(athlete.email);
          const problem = ageProblem(rules, birthDate);
          if (!problem) continue;
          const age =
            birthDate && rules.ageCutoffDate
              ? ` (${ageAt(birthDate, rules.ageCutoffDate)} anos em ${brDate(rules.ageCutoffDate)})`
              : '';
          issues.push({
            kind: birthDate ? 'age' : 'missing_birth_date',
            teamId: team.id,
            categoryId: category.id,
            athleteId: athlete.id,
            linkId: linkIdOf(athlete.email),
            requirementId: null,
            blocking: true,
            message: `${name}, ${where}: ${problem.replace(/\.$/, '')}${age}.`,
          });
        }
      }

      if (requiredData.length > 0 || requiredDocuments.length > 0) {
        const reportedBirthDate = new Set(
          issues
            .filter((i) => i.kind === 'missing_birth_date')
            .map((i) => i.athleteId),
        );
        const sorted = [...programAthletes].sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(
            `${b.firstName} ${b.lastName}`,
            'pt-BR',
          ),
        );
        for (const athlete of sorted) {
          const athleteEntries = entries.filter(
            (e) => e.athleteId === athlete.id,
          );
          const first = athleteEntries[0];
          if (!first) continue;
          const athleteCategories = pairs
            .filter(({ team, category }) =>
              athleteEntries.some(
                (e) => e.teamId === team.id && e.categoryId === category.id,
              ),
            )
            .map(({ category }) => category);
          const name = `${athlete.firstName} ${athlete.lastName}`.trim();

          for (const requirement of requiredData) {
            if (!requirementApplies(requirement, athleteCategories)) continue;
            let filled: boolean;
            if (requirement.preset === 'birth_date') {
              if (reportedBirthDate.has(athlete.id)) continue;
              filled = !!birthDateOf(athlete.email);
            } else if (requirement.preset === 'cpf') {
              filled = !!(
                accountCpfs.get(athlete.email.toLowerCase()) ?? athlete.cpf
              );
            } else {
              filled = values.some(
                (v) =>
                  v.programAthleteId === athlete.id &&
                  v.requirementId === requirement.id,
              );
            }
            if (filled) continue;
            issues.push({
              kind: 'missing_requirement',
              teamId: first.teamId,
              categoryId: first.categoryId,
              athleteId: athlete.id,
              linkId: linkIdOf(athlete.email),
              requirementId: requirement.id,
              blocking: true,
              message: `${name}: falta ${requirement.label.toLowerCase()}.`,
            });
          }
          for (const requirement of requiredDocuments) {
            if (!requirementApplies(requirement, athleteCategories)) continue;
            const doc = documents.find(
              (d) =>
                d.programAthleteId === athlete.id &&
                d.requirementId === requirement.id,
            );
            if (doc && doc.status !== 'contested') continue;
            documentsPendingCount += 1;
            issues.push({
              kind: 'missing_document',
              teamId: first.teamId,
              categoryId: first.categoryId,
              athleteId: athlete.id,
              linkId: linkIdOf(athlete.email),
              requirementId: requirement.id,
              blocking: !settings.allowSubmitWithoutDocuments,
              message: doc
                ? `${name}: ${requirement.label.toLowerCase()} contestado (${doc.contestReason ?? 'sem motivo'}).`
                : `${name}: falta ${requirement.label.toLowerCase()}.`,
            });
          }
        }
      }

      result.set(participation.id, { issues, documentsPendingCount });
    }
    return result;
  }

  private async previousTeamNames(
    userId: string,
    aliasId: string,
    currentNames: string[],
  ): Promise<string[]> {
    const others = await this.participationsRepo.find({
      where: { userId, aliasId: Not(aliasId) },
      relations: ['teams'],
    });
    const taken = new Set(currentNames.map((n) => n.trim().toLowerCase()));
    const names = new Map<string, string>();
    for (const p of others) {
      for (const t of p.teams) {
        const key = t.name.trim().toLowerCase();
        if (!taken.has(key) && !names.has(key)) names.set(key, t.name.trim());
      }
    }
    return [...names.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }
}

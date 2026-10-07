import { UserRole } from '../../common/enums/user-role.enum';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { cpf as cpfValidator } from 'cpf-cnpj-validator';
import { ProgramAthlete } from '../entities/program-athlete.entity';
import { ProgramParticipation } from '../entities/program-participation.entity';
import { TeamCategoryAthlete } from '../entities/team-category-athlete.entity';
import { AthleteRequirementValue } from '../entities/athlete-requirement-value.entity';
import { Category } from '../../categories/entities/category.entity';
import { AthleteLink } from '../../athletes/entities/athlete-link.entity';
import { DocumentType } from '../../common/enums/document-type.enum';
import { EventsService } from '../../events/services/events.service';
import { UsersService } from '../../users/services/users.service';
import { RegistrationSettingsService } from './registration-settings.service';
import { AthleteRequirementDocument } from '../../documents/entities/athlete-requirement-document.entity';
import {
  PrivateFilesService,
  type PrivateFileView,
} from '../../documents/services/private-files.service';
import { UserDocumentsService } from '../../documents/services/user-documents.service';
import { assertAthleteDocumentFiles } from '../../common/config/athlete-document-upload.config';
import { Event } from '../../events/entities/event.entity';
import { isRegistrationOpen } from '../../events/registration-window';
import { programCanEditRegistration } from '../registration-edit';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/enums/notification-type.enum';
import { NotificationAudience } from '../../notifications/enums/notification-audience.enum';
import { MailService } from '../../auth/services/mail.service';
import { ProgramAthletesService } from './program-athletes.service';
import {
  requirementApplies,
  type RegistrationRequirement,
} from '../registration-requirements';

// De onde vem o valor da data de nascimento/CPF (valor único do atleta).
export type RequirementValueSource = 'account' | 'roster' | 'event' | null;

export interface AthleteDocumentView {
  status: 'sent' | 'contested';
  contestReason: string | null;
  contestedAt: Date | null;
  updatedAt: Date;
  files: PrivateFileView[];
}

export interface AthleteRequirementView {
  requirement: RegistrationRequirement;
  // Vale pras categorias em que o atleta compete (appliesTo).
  applies: boolean;
  value: string | null;
  // Itens de documento: o que foi enviado (null = nada ainda).
  document: AthleteDocumentView | null;
  // Itens de documento: quem está vendo pode enviar/trocar este agora
  // (o atleta, depois de a inscrição ser enviada, só manda o que falta ou
  // foi contestado).
  documentEditable: boolean;
  // Data de nascimento/CPF da conta do atleta: não se edita por aqui.
  readOnly: boolean;
  source: RequirementValueSource;
}

export interface AthleteRequirementsView {
  name: string;
  email: string;
  // Quem está vendo pode enviar/trocar documentos agora (ver
  // canSendDocuments) e mudar os dados (ficha não travada).
  documentsEditable: boolean;
  dataEditable: boolean;
  // Visão do atleta com a inscrição já enviada (só manda o que falta ou
  // foi contestado; o resto, pelo programa).
  athleteLocked: boolean;
  // O produtor permite enviar a ficha sem todos os documentos.
  allowSubmitWithoutDocuments: boolean;
  // Ficha do programa já enviada (o atleta só envia a parte dele antes).
  programSubmitted: boolean;
  // O próprio atleta enviou a parte dele.
  athleteSubmittedAt: Date | null;
  items: AthleteRequirementView[];
}

// Quem está agindo: produtor (admin/assessor), a conta Programa dona ou o
// próprio atleta (conta com o email do atleta do evento).
export type RequirementActor = 'staff' | 'program' | 'athlete';

// Documentos podem ser enviados/trocados até o prazo de inscrição, mesmo
// com a ficha já enviada (decisão do usuário, 2026-10-06), ou enquanto a
// ficha estiver liberada pelo organizador. O produtor pode sempre (a trava
// de evento concluído vale pra todos, CompletedEventLockGuard).
export function canSendDocuments(
  actor: RequirementActor,
  event: Event,
  participation: ProgramParticipation,
): boolean {
  if (actor === 'staff') return true;
  return (
    isRegistrationOpen(event) ||
    programCanEditRegistration(event, participation)
  );
}

// Dados: o programa segue a trava da ficha (ProgramAccessGuard); o atleta,
// a mesma janela dos documentos.
function canEditData(
  actor: RequirementActor,
  event: Event,
  participation: ProgramParticipation,
  athlete: ProgramAthlete,
): boolean {
  if (actor === 'staff') return true;
  if (actor === 'program')
    return programCanEditRegistration(event, participation);
  if (athleteLocked(participation, athlete)) return false;
  return canSendDocuments(actor, event, participation);
}

// Inscrição enviada (pelo programa ou pelo próprio atleta): o atleta não
// muda mais dados nem troca/exclui documento já enviado; alterações passam
// pelo programa (decisão do usuário, 2026-10-06). Exceções: documento que
// ainda falta e documento contestado, até o prazo.
function athleteLocked(
  participation: ProgramParticipation,
  athlete: ProgramAthlete,
): boolean {
  return !!participation.submittedAt || !!athlete.athleteSubmittedAt;
}

const ATHLETE_LOCKED_MESSAGE =
  'Sua inscrição já foi enviada. Para mudar algo, fale com o seu programa.';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

// Respostas de um atleta do evento aos dados pedidos na inscrição
// (2026-10-06). Lido e preenchido pelo produtor (admin/assessor) e pela
// conta Programa dona (ProgramAccessGuard). Documentos ainda não.
@Injectable()
export class ProgramAthleteRequirementsService {
  private readonly logger = new Logger(ProgramAthleteRequirementsService.name);

  constructor(
    @InjectRepository(ProgramAthlete)
    private readonly athletesRepo: Repository<ProgramAthlete>,
    @InjectRepository(ProgramParticipation)
    private readonly participationsRepo: Repository<ProgramParticipation>,
    @InjectRepository(TeamCategoryAthlete)
    private readonly entriesRepo: Repository<TeamCategoryAthlete>,
    @InjectRepository(AthleteRequirementValue)
    private readonly valuesRepo: Repository<AthleteRequirementValue>,
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    @InjectRepository(AthleteLink)
    private readonly linksRepo: Repository<AthleteLink>,
    private readonly eventsService: EventsService,
    private readonly usersService: UsersService,
    private readonly settingsService: RegistrationSettingsService,
    private readonly programAthletesService: ProgramAthletesService,
    @InjectRepository(AthleteRequirementDocument)
    private readonly documentsRepo: Repository<AthleteRequirementDocument>,
    private readonly privateFiles: PrivateFilesService,
    private readonly userDocuments: UserDocumentsService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  async list(
    eventId: string,
    programId: string,
    athleteId: string,
    actor: RequirementActor = 'staff',
  ): Promise<AthleteRequirementsView> {
    const { athlete, participation, event } = await this.load(
      eventId,
      programId,
      athleteId,
    );
    return this.buildView(event, participation, athlete, actor);
  }

  // Inscrição do atleta do elenco que o programa ainda não pôs em
  // nenhuma categoria (sem linha de ProgramAthlete ainda): mesma visão,
  // vazia. A linha só nasce quando o atleta salva algo.
  previewForAthlete(
    event: Event,
    participation: ProgramParticipation,
    athlete: { firstName: string; lastName: string; email: string },
  ): Promise<AthleteRequirementsView> {
    const draft = this.athletesRepo.create({
      programId: participation.id,
      aliasId: event.aliasId,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      email: athlete.email,
      cpf: null,
      birthDate: null,
      athleteSubmittedAt: null,
    });
    return this.buildView(event, participation, draft, 'athlete');
  }

  private async buildView(
    event: Event,
    participation: ProgramParticipation,
    athlete: ProgramAthlete,
    actor: RequirementActor,
  ): Promise<AthleteRequirementsView> {
    const settings = await this.settingsService.getByAlias(event.aliasId);
    const saved = !!athlete.id;
    const categories = saved ? await this.athleteCategories(athlete.id) : [];
    const values = saved
      ? await this.valuesRepo.findBy({ programAthleteId: athlete.id })
      : [];
    const documents = saved
      ? await this.documentsRepo.findBy({ programAthleteId: athlete.id })
      : [];
    const files = await this.privateFiles.findByKeys(
      documents.flatMap((d) => d.fileKeys),
    );
    const { account, link } = await this.identity(athlete, participation);

    return {
      name: `${athlete.firstName} ${athlete.lastName}`.trim(),
      email: athlete.email,
      documentsEditable: canSendDocuments(actor, event, participation),
      dataEditable: canEditData(actor, event, participation, athlete),
      athleteLocked:
        actor === 'athlete' && athleteLocked(participation, athlete),
      allowSubmitWithoutDocuments: settings.allowSubmitWithoutDocuments,
      programSubmitted: !!participation.submittedAt,
      athleteSubmittedAt: athlete.athleteSubmittedAt,
      items: settings.requirements.map(
        (requirement): AthleteRequirementView => {
          const base = {
            requirement,
            applies: requirementApplies(requirement, categories),
            document: null,
            documentEditable: false,
          };
          if (requirement.kind === 'document') {
            const doc = documents.find(
              (d) => d.requirementId === requirement.id,
            );
            const docsWindow = canSendDocuments(actor, event, participation);
            return {
              ...base,
              value: null,
              documentEditable:
                docsWindow &&
                (actor !== 'athlete' ||
                  !athleteLocked(participation, athlete) ||
                  !doc ||
                  doc.status === 'contested'),
              document: doc
                ? {
                    status: doc.status,
                    contestReason: doc.contestReason,
                    contestedAt: doc.contestedAt,
                    updatedAt: doc.updatedAt,
                    files: doc.fileKeys
                      .map((key) => files.get(key))
                      .filter((f) => !!f)
                      .map((f) => PrivateFilesService.view(f)),
                  }
                : null,
              readOnly: false,
              source: null,
            };
          }
          if (requirement.preset === 'birth_date') {
            const accountDate = account?.birthDate ?? null;
            return {
              ...base,
              value:
                accountDate ?? link?.birthDate ?? athlete.birthDate ?? null,
              readOnly: !!accountDate,
              source: accountDate
                ? 'account'
                : link?.birthDate
                  ? 'roster'
                  : athlete.birthDate
                    ? 'event'
                    : null,
            };
          }
          if (requirement.preset === 'cpf') {
            const accountCpf = this.accountCpf(account);
            return {
              ...base,
              value: accountCpf ?? athlete.cpf ?? null,
              readOnly: !!accountCpf,
              source: accountCpf ? 'account' : athlete.cpf ? 'event' : null,
            };
          }
          return {
            ...base,
            value:
              values.find((v) => v.requirementId === requirement.id)?.value ??
              null,
            readOnly: false,
            source: null,
          };
        },
      ),
    };
  }

  async set(
    eventId: string,
    programId: string,
    athleteId: string,
    requirementId: string,
    rawValue: string | null,
    userId: string,
    actor: RequirementActor = 'staff',
  ): Promise<AthleteRequirementsView> {
    const { athlete, participation, aliasId, event } = await this.load(
      eventId,
      programId,
      athleteId,
    );
    if (!canEditData(actor, event, participation, athlete)) {
      throw new ForbiddenException(
        actor === 'athlete' && athleteLocked(participation, athlete)
          ? ATHLETE_LOCKED_MESSAGE
          : 'Não dá mais para mudar os dados desta inscrição.',
      );
    }
    const settings = await this.settingsService.getByAlias(aliasId);
    const requirement = settings.requirements.find(
      (r) => r.id === requirementId,
    );
    if (!requirement) throw new NotFoundException('Item não encontrado.');
    const value = rawValue?.trim() || null;

    if (requirement.kind === 'document') {
      throw new BadRequestException('Envie o documento como arquivo.');
    }

    if (requirement.preset === 'birth_date') {
      if (value && (!isValidIsoDate(value) || value > this.today())) {
        throw new BadRequestException('Data de nascimento inválida.');
      }
      const { account, link } = await this.identity(athlete, participation);
      if (account?.birthDate) {
        throw new ConflictException(
          'A data de nascimento deste atleta vem da conta dele e não pode ser alterada aqui.',
        );
      }
      // Uma data por atleta: no elenco do programa, se o atleta está nele
      // (vale pros próximos eventos); senão no atleta do evento.
      if (link) {
        link.birthDate = value;
        await this.linksRepo.save(link);
      } else {
        await this.programAthletesService.update(
          eventId,
          programId,
          athleteId,
          { birthDate: value },
          userId,
        );
      }
      return this.list(eventId, programId, athleteId, actor);
    }

    if (requirement.preset === 'cpf') {
      const digits = value?.replace(/\D/g, '') || null;
      if (digits && !cpfValidator.isValid(digits)) {
        throw new BadRequestException('CPF inválido.');
      }
      const { account } = await this.identity(athlete, participation);
      if (this.accountCpf(account)) {
        throw new ConflictException(
          'O CPF deste atleta vem da conta dele e não pode ser alterado aqui.',
        );
      }
      await this.programAthletesService.update(
        eventId,
        programId,
        athleteId,
        { cpf: digits },
        userId,
      );
      return this.list(eventId, programId, athleteId, actor);
    }

    const stored = value ? this.normalize(requirement, value) : null;
    const existing = await this.valuesRepo.findOneBy({
      programAthleteId: athlete.id,
      requirementId,
    });
    if (!stored) {
      if (existing) await this.valuesRepo.remove(existing);
    } else if (existing) {
      existing.value = stored;
      existing.updatedBy = userId;
      await this.valuesRepo.save(existing);
    } else {
      await this.valuesRepo.save(
        this.valuesRepo.create({
          aliasId,
          programAthleteId: athlete.id,
          requirementId,
          value: stored,
          updatedBy: userId,
        }),
      );
    }
    return this.list(eventId, programId, athleteId, actor);
  }

  // Envia (ou troca) o documento de um item: arquivos novos e, pro próprio
  // atleta, também documentos da biblioteca dele. Arquivo novo enviado pelo
  // atleta entra na biblioteca. Reenviar tira a contestação.
  async setDocument(
    eventId: string,
    programId: string,
    athleteId: string,
    requirementId: string,
    params: {
      files?: Express.Multer.File[];
      libraryDocumentIds?: string[];
    },
    userId: string,
    actor: RequirementActor,
  ): Promise<AthleteRequirementsView> {
    const { athlete, participation, aliasId, event } = await this.load(
      eventId,
      programId,
      athleteId,
    );
    this.assertDocumentsWindow(actor, event, participation);
    const requirement = await this.documentRequirement(aliasId, requirementId);
    const existing = await this.documentsRepo.findOneBy({
      programAthleteId: athlete.id,
      requirementId,
    });
    if (
      actor === 'athlete' &&
      athleteLocked(participation, athlete) &&
      existing &&
      existing.status !== 'contested'
    ) {
      throw new ForbiddenException(ATHLETE_LOCKED_MESSAGE);
    }
    const libraryIds = [...new Set(params.libraryDocumentIds ?? [])];
    if (libraryIds.length > 0 && actor !== 'athlete') {
      throw new ForbiddenException(
        'Só o próprio atleta usa os documentos da biblioteca dele.',
      );
    }
    const files = assertAthleteDocumentFiles(params.files, {
      allowEmpty: libraryIds.length > 0,
    });
    if (files.length + libraryIds.length > 4) {
      throw new BadRequestException('No máximo 4 arquivos por documento.');
    }
    const library = await this.userDocuments.findOwned(userId, libraryIds);

    const keys = library.map((d) => d.fileKey);
    for (const file of files) {
      if (actor === 'athlete') {
        const doc = await this.userDocuments.addFile(
          userId,
          file,
          requirement.label,
        );
        keys.push(doc.fileKey);
      } else {
        const saved = await this.privateFiles.save(
          file,
          `events/${aliasId}`,
          userId,
        );
        keys.push(saved.key);
      }
    }

    const row =
      existing ??
      this.documentsRepo.create({
        aliasId,
        programAthleteId: athlete.id,
        requirementId,
      });
    // Os arquivos antigos saem na limpeza, se nada mais apontar pra eles.
    row.fileKeys = keys;
    row.status = 'sent';
    row.contestReason = null;
    row.contestedAt = null;
    row.contestedBy = null;
    row.updatedBy = userId;
    await this.documentsRepo.save(row);
    return this.list(eventId, programId, athleteId, actor);
  }

  async removeDocument(
    eventId: string,
    programId: string,
    athleteId: string,
    requirementId: string,
    actor: RequirementActor,
  ): Promise<AthleteRequirementsView> {
    const { athlete, participation, aliasId, event } = await this.load(
      eventId,
      programId,
      athleteId,
    );
    this.assertDocumentsWindow(actor, event, participation);
    if (actor === 'athlete' && athleteLocked(participation, athlete)) {
      throw new ForbiddenException(ATHLETE_LOCKED_MESSAGE);
    }
    await this.documentRequirement(aliasId, requirementId);
    await this.documentsRepo.delete({
      programAthleteId: athlete.id,
      requirementId,
    });
    return this.list(eventId, programId, athleteId, actor);
  }

  async streamDocumentFile(
    eventId: string,
    programId: string,
    athleteId: string,
    requirementId: string,
    index: number,
  ): Promise<StreamableFile> {
    const { athlete } = await this.load(eventId, programId, athleteId);
    const doc = await this.documentsRepo.findOneBy({
      programAthleteId: athlete.id,
      requirementId,
    });
    const key = doc?.fileKeys[index];
    if (!key) throw new NotFoundException('Arquivo não encontrado.');
    return this.privateFiles.stream(key);
  }

  // Produtor contesta um documento: programa e atleta são avisados e
  // reenviam (até o prazo de inscrição).
  async contestDocument(
    eventId: string,
    programId: string,
    athleteId: string,
    requirementId: string,
    reason: string,
    userId: string,
  ): Promise<AthleteRequirementsView> {
    const { athlete, participation, aliasId, event } = await this.load(
      eventId,
      programId,
      athleteId,
    );
    const requirement = await this.documentRequirement(aliasId, requirementId);
    const doc = await this.documentsRepo.findOneBy({
      programAthleteId: athlete.id,
      requirementId,
    });
    if (!doc) throw new NotFoundException('Documento ainda não enviado.');
    const text = reason.trim();
    if (!text)
      throw new BadRequestException('Explique o motivo da contestação.');
    doc.status = 'contested';
    doc.contestReason = text.slice(0, 1000);
    doc.contestedAt = new Date();
    doc.contestedBy = userId;
    await this.documentsRepo.save(doc);

    const athleteName = `${athlete.firstName} ${athlete.lastName}`.trim();
    const title = `Documento contestado: ${requirement.label} de ${athleteName}`;
    const lines = [
      `O organizador do evento ${event.name} contestou o documento "${requirement.label}" de ${athleteName}. O motivo está logo abaixo.`,
      isRegistrationOpen(event)
        ? 'Envie o documento de novo até o prazo de inscrição.'
        : 'Fale com o organizador para combinar o reenvio.',
    ];
    try {
      if (participation.userId) {
        await this.notificationsService.create(
          aliasId,
          NotificationType.DOCUMENT_CONTESTED,
          NotificationAudience.ALL,
          title,
          undefined,
          participation.userId,
        );
        await this.mailService.sendNotice({
          to: [participation.email],
          subject: `[${event.name}] ${title}`,
          heading: 'Documento contestado',
          lines,
          message: doc.contestReason,
          actionPath: `/events/${aliasId}/registration`,
          actionLabel: 'Abrir a inscrição',
          event: { name: event.name, logoUrl: event.logoUrl },
        });
      }
      // Atleta com conta também recebe no app (2026-10-07). Conta Programa
      // nunca é atleta (mesmo email só por engano): não manda pra ela.
      const athleteUser = await this.usersService.findByEmailInsensitive(
        athlete.email,
      );
      if (athleteUser && athleteUser.role !== UserRole.PROGRAM) {
        await this.notificationsService.create(
          aliasId,
          NotificationType.DOCUMENT_CONTESTED,
          NotificationAudience.ALL,
          `Documento contestado: ${requirement.label}`,
          undefined,
          athleteUser.id,
        );
      }
      await this.mailService.sendNotice({
        to: [athlete.email],
        subject: `[${event.name}] ${title}`,
        heading: 'Documento contestado',
        lines,
        // Texto do produtor em destaque, como o pedido do programa.
        message: doc.contestReason,
        actionPath: `/events/${aliasId}/my-registration`,
        actionLabel: 'Enviar de novo',
        event: { name: event.name, logoUrl: event.logoUrl },
      });
    } catch (err) {
      // O aviso é melhor esforço: a contestação já está gravada.
      this.logger.error(
        'Falha ao avisar contestação de documento',
        err as Error,
      );
    }
    return this.list(eventId, programId, athleteId, 'staff');
  }

  // O próprio atleta envia a parte dele (opcional: o programa pode fazer
  // tudo). Só enquanto a ficha do programa está em rascunho e no prazo;
  // depois disso a tela do atleta vira "Minha inscrição". Precisa dos dados
  // obrigatórios e, salvo permissão do produtor, dos documentos.
  async athleteSubmit(
    eventId: string,
    programId: string,
    athleteId: string,
  ): Promise<AthleteRequirementsView> {
    const view = await this.list(eventId, programId, athleteId, 'athlete');
    if (view.programSubmitted) {
      throw new ConflictException(
        'O programa já enviou a inscrição: não é preciso enviar de novo.',
      );
    }
    if (!view.documentsEditable) {
      throw new ForbiddenException(
        'As inscrições deste evento estão encerradas.',
      );
    }
    const missing = pendingRequirements(view, { includeOptionalDocs: false });
    if (missing.length > 0) {
      throw new BadRequestException(
        `Falta: ${missing.map((i) => i.requirement.label).join(', ')}.`,
      );
    }
    await this.athletesRepo.update(athleteId, {
      athleteSubmittedAt: new Date(),
    });
    return this.list(eventId, programId, athleteId, 'athlete');
  }

  private assertDocumentsWindow(
    actor: RequirementActor,
    event: Event,
    participation: ProgramParticipation,
  ) {
    if (!canSendDocuments(actor, event, participation)) {
      throw new ForbiddenException(
        'O prazo de inscrição acabou: os documentos não podem mais ser enviados.',
      );
    }
  }

  private async documentRequirement(
    aliasId: string,
    requirementId: string,
  ): Promise<RegistrationRequirement> {
    const settings = await this.settingsService.getByAlias(aliasId);
    const requirement = settings.requirements.find(
      (r) => r.id === requirementId,
    );
    if (!requirement || requirement.kind !== 'document') {
      throw new NotFoundException('Documento não encontrado.');
    }
    return requirement;
  }

  // Valida e padroniza o valor de texto/lista/data.
  private normalize(
    requirement: RegistrationRequirement,
    value: string,
  ): string {
    const name = requirement.label;
    if (requirement.kind === 'select') {
      if (!requirement.options.includes(value)) {
        throw new BadRequestException(`Opção inválida em ${name}.`);
      }
      return value;
    }
    if (requirement.kind === 'date') {
      if (!isValidIsoDate(value)) {
        throw new BadRequestException(`Data inválida em ${name}.`);
      }
      return value;
    }
    if (requirement.preset === 'phone') {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 11) {
        throw new BadRequestException('Telefone inválido (DDD + número).');
      }
      return digits;
    }
    return value;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private accountCpf(
    account: Awaited<ReturnType<UsersService['findByEmailInsensitive']>>,
  ): string | null {
    return account?.documentType === DocumentType.CPF
      ? (account.documentNumber ?? null)
      : null;
  }

  private async athleteCategories(athleteId: string): Promise<Category[]> {
    const entries = await this.entriesRepo.findBy({ athleteId });
    if (entries.length === 0) return [];
    return this.categoriesRepo.findBy({
      id: In([...new Set(entries.map((e) => e.categoryId))]),
    });
  }

  // Conta do atleta (pelo email) e vínculo no elenco do programa.
  private async identity(
    athlete: ProgramAthlete,
    participation: ProgramParticipation,
  ) {
    const account = await this.usersService.findByEmailInsensitive(
      athlete.email,
    );
    const link = participation.userId
      ? await this.linksRepo
          .createQueryBuilder('link')
          .where('link.programUserId = :programUserId', {
            programUserId: participation.userId,
          })
          .andWhere('LOWER(link.email) = LOWER(:email)', {
            email: athlete.email,
          })
          .andWhere('link.endedAt IS NULL')
          .getOne()
      : null;
    return { account, link };
  }

  private async load(eventId: string, programId: string, athleteId: string) {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const participation = await this.participationsRepo.findOneBy({
      id: programId,
      aliasId: event.aliasId,
    });
    if (!participation) throw new NotFoundException('Programa não encontrado');
    const athlete = await this.athletesRepo.findOneBy({
      id: athleteId,
      programId,
    });
    if (!athlete) throw new NotFoundException('Atleta não encontrado.');
    return { athlete, participation, aliasId: event.aliasId, event };
  }
}

// Itens obrigatórios que ainda faltam pra um atleta (que valem pras
// categorias dele). Documento contestado conta como faltando. Documentos
// ficam de fora quando o produtor permite enviar sem eles.
export function pendingRequirements(
  view: AthleteRequirementsView,
  { includeOptionalDocs }: { includeOptionalDocs: boolean },
): AthleteRequirementView[] {
  return view.items.filter((item) => {
    if (!item.applies || !item.requirement.required) return false;
    if (item.requirement.kind === 'document') {
      if (view.allowSubmitWithoutDocuments && !includeOptionalDocs)
        return false;
      return !item.document || item.document.status === 'contested';
    }
    return !item.value;
  });
}

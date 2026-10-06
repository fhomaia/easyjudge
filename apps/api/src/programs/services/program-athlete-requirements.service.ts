import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
import { ProgramAthletesService } from './program-athletes.service';
import {
  requirementApplies,
  type RegistrationRequirement,
} from '../registration-requirements';

// De onde vem o valor da data de nascimento/CPF (valor único do atleta).
export type RequirementValueSource = 'account' | 'roster' | 'event' | null;

export interface AthleteRequirementView {
  requirement: RegistrationRequirement;
  // Vale pras categorias em que o atleta compete (appliesTo).
  applies: boolean;
  value: string | null;
  // Data de nascimento/CPF da conta do atleta: não se edita por aqui.
  readOnly: boolean;
  source: RequirementValueSource;
}

export interface AthleteRequirementsView {
  name: string;
  email: string;
  items: AthleteRequirementView[];
}

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
  ) {}

  async list(
    eventId: string,
    programId: string,
    athleteId: string,
  ): Promise<AthleteRequirementsView> {
    const { athlete, participation, aliasId } = await this.load(
      eventId,
      programId,
      athleteId,
    );
    const settings = await this.settingsService.getByAlias(aliasId);
    const categories = await this.athleteCategories(athlete.id);
    const values = await this.valuesRepo.findBy({
      programAthleteId: athlete.id,
    });
    const { account, link } = await this.identity(athlete, participation);

    return {
      name: `${athlete.firstName} ${athlete.lastName}`.trim(),
      email: athlete.email,
      items: settings.requirements.map((requirement) => {
        const base = {
          requirement,
          applies: requirementApplies(requirement, categories),
        };
        if (requirement.preset === 'birth_date') {
          const accountDate = account?.birthDate ?? null;
          return {
            ...base,
            value: accountDate ?? link?.birthDate ?? athlete.birthDate ?? null,
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
      }),
    };
  }

  async set(
    eventId: string,
    programId: string,
    athleteId: string,
    requirementId: string,
    rawValue: string | null,
    userId: string,
  ): Promise<AthleteRequirementsView> {
    const { athlete, participation, aliasId } = await this.load(
      eventId,
      programId,
      athleteId,
    );
    const settings = await this.settingsService.getByAlias(aliasId);
    const requirement = settings.requirements.find(
      (r) => r.id === requirementId,
    );
    if (!requirement) throw new NotFoundException('Item não encontrado.');
    const value = rawValue?.trim() || null;

    if (requirement.kind === 'document') {
      throw new BadRequestException(
        'O envio de documentos ainda não está disponível.',
      );
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
      return this.list(eventId, programId, athleteId);
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
      return this.list(eventId, programId, athleteId);
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
    return this.list(eventId, programId, athleteId);
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
    return { athlete, participation, aliasId: event.aliasId };
  }
}

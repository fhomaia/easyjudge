import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegistrationSettings } from '../entities/registration-settings.entity';
import {
  defaultRegistrationSettings,
  LOCKED_LABEL_PRESETS,
  REQUIREMENT_PRESETS,
  type RegistrationRequirement,
  type RegistrationSettingsView,
  type RequirementPreset,
} from '../registration-requirements';
import { UpdateRegistrationSettingsDto } from '../dto/update-registration-settings.dto';
import { EventsService } from '../../events/services/events.service';
import { CategoryCriteriaService } from '../../categories/services/category-criteria.service';
import {
  CRITERION_LABELS,
  isOptionCriterion,
  type OptionCriterionKey,
} from '../../categories/category-criteria';
import { CategoryCriterionKey } from '../../categories/enums/category-criterion-key.enum';

const MAX_REQUIREMENTS = 30;

// Configuração da inscrição do evento (ver RegistrationSettings): dados e
// documentos pedidos aos atletas.
@Injectable()
export class RegistrationSettingsService {
  constructor(
    @InjectRepository(RegistrationSettings)
    private readonly settingsRepo: Repository<RegistrationSettings>,
    private readonly eventsService: EventsService,
    private readonly categoryCriteriaService: CategoryCriteriaService,
  ) {}

  async getForEvent(eventId: string): Promise<RegistrationSettingsView> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    return this.getByAlias(event.aliasId);
  }

  async getByAlias(aliasId: string): Promise<RegistrationSettingsView> {
    const row = await this.settingsRepo.findOneBy({ aliasId });
    if (!row) return defaultRegistrationSettings();
    return {
      allowSubmitWithoutDocuments: row.allowSubmitWithoutDocuments,
      requirements: row.requirements,
    };
  }

  async update(
    eventId: string,
    dto: UpdateRegistrationSettingsDto,
  ): Promise<RegistrationSettingsView> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const previous = await this.getByAlias(event.aliasId);
    const knownIds = new Set(previous.requirements.map((r) => r.id));
    const criteria = await this.categoryCriteriaService.getByAlias(
      event.aliasId,
    );

    if (dto.requirements.length > MAX_REQUIREMENTS) {
      throw new BadRequestException(
        `No máximo ${MAX_REQUIREMENTS} dados e documentos.`,
      );
    }

    const labels = new Set<string>();
    const presets = new Set<RequirementPreset>();
    const ids = new Set<string>();
    const requirements = dto.requirements.map((r): RegistrationRequirement => {
      // Data, CPF e telefone: nome fixo (ver LOCKED_LABEL_PRESETS).
      const lockedPreset =
        r.preset && LOCKED_LABEL_PRESETS.includes(r.preset as RequirementPreset)
          ? (r.preset as RequirementPreset)
          : null;
      const label = lockedPreset
        ? REQUIREMENT_PRESETS[lockedPreset].label
        : (r.label ?? '').trim();
      if (!label) {
        throw new BadRequestException(
          'Todo dado ou documento precisa de nome.',
        );
      }
      if (labels.has(label.toLowerCase())) {
        throw new BadRequestException(`"${label}" aparece mais de uma vez.`);
      }
      labels.add(label.toLowerCase());

      const preset = (r.preset ?? null) as RequirementPreset | null;
      if (preset) {
        if (presets.has(preset)) {
          throw new BadRequestException(
            `"${REQUIREMENT_PRESETS[preset].label}" aparece mais de uma vez.`,
          );
        }
        presets.add(preset);
        // O tipo da sugestão é fixo (CPF é texto, identidade é documento).
        if (r.kind !== REQUIREMENT_PRESETS[preset].kind) {
          throw new BadRequestException(`Tipo inválido em "${label}".`);
        }
      }

      const options =
        r.kind === 'select'
          ? [...new Set((r.options ?? []).map((o) => o.trim()).filter(Boolean))]
          : [];
      if (r.kind === 'select' && options.length < 2) {
        throw new BadRequestException(
          `"${label}": cadastre ao menos duas opções na lista.`,
        );
      }

      const id =
        r.id && knownIds.has(r.id) && !ids.has(r.id)
          ? r.id
          : `req_${randomUUID().slice(0, 8)}`;
      ids.add(id);

      return {
        id,
        kind: r.kind,
        preset,
        label,
        description: r.description?.trim() || null,
        required: r.required,
        options,
        appliesTo: this.buildAppliesTo(label, r.appliesTo ?? null, criteria),
      };
    });

    const row =
      (await this.settingsRepo.findOneBy({ aliasId: event.aliasId })) ??
      this.settingsRepo.create({ aliasId: event.aliasId });
    row.allowSubmitWithoutDocuments = dto.allowSubmitWithoutDocuments;
    row.requirements = requirements;
    await this.settingsRepo.save(row);
    return {
      allowSubmitWithoutDocuments: row.allowSubmitWithoutDocuments,
      requirements,
    };
  }

  // { critério: [opções] } com critério e opções existentes no evento;
  // vazio = todas as categorias (null).
  private buildAppliesTo(
    label: string,
    appliesTo: Record<string, string[]> | null,
    criteria: Awaited<ReturnType<CategoryCriteriaService['getByAlias']>>,
  ): Partial<Record<OptionCriterionKey, string[]>> | null {
    if (!appliesTo) return null;
    const result: Partial<Record<OptionCriterionKey, string[]>> = {};
    for (const [key, values] of Object.entries(appliesTo)) {
      const criterionKey = key as CategoryCriterionKey;
      if (
        !Object.values(CategoryCriterionKey).includes(criterionKey) ||
        !isOptionCriterion(criterionKey) ||
        !Array.isArray(values)
      ) {
        throw new BadRequestException(`Categorias inválidas em "${label}".`);
      }
      if (values.length === 0) continue;
      const known = new Set(
        criteria
          .find((c) => c.key === criterionKey)
          ?.options.map((o) => o.id) ?? [],
      );
      if (values.some((v) => typeof v !== 'string' || !known.has(v))) {
        throw new BadRequestException(
          `"${label}": opção inválida em ${CRITERION_LABELS[criterionKey]}.`,
        );
      }
      result[criterionKey] = [...new Set(values)];
    }
    return Object.keys(result).length ? result : null;
  }
}

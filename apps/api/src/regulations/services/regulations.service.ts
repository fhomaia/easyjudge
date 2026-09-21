import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomDeduction, Regulation } from '../entities/regulation.entity';
import { RegulationDocument } from '../entities/regulation-document.entity';
import { UpdateRegulationDto } from '../dto/update-regulation.dto';
import {
  RegulationDocumentKind,
  SINGLE_SLOT_DOCUMENT_KINDS,
} from '../enums/regulation-document-kind.enum';
import { RegulationDeductionMode } from '../enums/regulation-deduction-mode.enum';
import { DeductionType } from '../enums/deduction-type.enum';
import {
  CUSTOM_DEDUCTION_PREFIX,
  DEDUCTION_LABELS,
  DEDUCTION_TYPES_ORDER,
  IASF_DEFAULT_DEDUCTIONS,
} from '../constants/iasf-deductions';
import { EventsService } from '../../events/services/events.service';
import { EventActivityLogService } from '../../events/services/event-activity-log.service';
import { EventActivityAction } from '../../events/enums/event-activity-action.enum';
import { StorageService } from '../../common/services/storage.service';

export interface DeductionRuleView {
  // DeductionType (padrão) ou custom_<uuid> (criado pelo organizador).
  type: string;
  label: string;
  isCustom: boolean;
  // null nos tipos personalizados (não existe padrão IASF).
  defaultValue: number | null;
  // Sempre <= 0: é somado ao total (deduzir = somar um valor negativo).
  value: number;
}

export interface RegulationView {
  eventId: string;
  deductionMode: RegulationDeductionMode;
  deductions: DeductionRuleView[];
  // Tipos padrão removidos neste evento (modo custom) — o cliente
  // oferece restaurar.
  hiddenDeductions: DeductionRuleView[];
  documents: RegulationDocument[];
  updatedAt: Date | null;
}

@Injectable()
export class RegulationsService {
  constructor(
    @InjectRepository(Regulation)
    private readonly regulationsRepo: Repository<Regulation>,
    @InjectRepository(RegulationDocument)
    private readonly documentsRepo: Repository<RegulationDocument>,
    private readonly eventsService: EventsService,
    private readonly activityLogService: EventActivityLogService,
    private readonly storageService: StorageService,
  ) {}

  async getForEvent(eventId: string): Promise<RegulationView> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const regulation = await this.regulationsRepo.findOne({
      where: { aliasId: event.aliasId },
      relations: ['documents'],
    });
    return this.toView(eventId, regulation);
  }

  async updateDeductions(
    eventId: string,
    dto: UpdateRegulationDto,
    userId: string,
  ): Promise<RegulationView> {
    const regulation = await this.getOrCreateForEvent(eventId);
    const existingCustom = regulation.customDeductions ?? [];

    const existingHidden = regulation.hiddenDeductions ?? [];

    const nextMode = dto.deductionMode ?? regulation.deductionMode;

    if (dto.hiddenDeductions !== undefined) {
      if (nextMode !== RegulationDeductionMode.CUSTOM) {
        throw new BadRequestException(
          'Só é possível remover tipos de dedução no modo Personalizado.',
        );
      }
      const validTypes = new Set<string>(Object.values(DeductionType));
      if (dto.hiddenDeductions.some((t) => !validTypes.has(t))) {
        throw new BadRequestException('Tipo de dedução inválido.');
      }
      const newlyHidden = dto.hiddenDeductions.filter(
        (t) => !existingHidden.includes(t),
      );
      await this.assertDeductionsNotUsed(
        regulation.aliasId,
        newlyHidden.map((t) => ({
          id: t,
          label: DEDUCTION_LABELS[t as DeductionType],
        })),
      );
      regulation.hiddenDeductions = dto.hiddenDeductions;
    }

    if (dto.customDeductions !== undefined) {
      if (nextMode !== RegulationDeductionMode.CUSTOM) {
        throw new BadRequestException(
          'Tipos de dedução personalizados só existem no modo Personalizado.',
        );
      }
      const next = this.buildCustomDeductions(
        dto.customDeductions,
        existingCustom,
      );
      const nextIds = new Set(next.map((d) => d.id));
      const removed = existingCustom.filter((d) => !nextIds.has(d.id));
      await this.assertDeductionsNotUsed(regulation.aliasId, removed);
      regulation.customDeductions = next;
    }

    if (
      dto.deductionMode === RegulationDeductionMode.IASF &&
      regulation.deductionMode !== RegulationDeductionMode.IASF
    ) {
      // No modo IASF os tipos personalizados somem da lista e valeriam 0
      // — mudaria a nota de quem já foi julgado com eles.
      await this.assertDeductionsNotUsed(
        regulation.aliasId,
        existingCustom,
        'Não é possível voltar para o modo IASF',
      );
    }

    if (dto.deductionMode) {
      regulation.deductionMode = dto.deductionMode;
    }

    // No modo Personalizado precisa sobrar ao menos um tipo, senão o
    // jurado de legalidade fica sem nada pra aplicar.
    if (regulation.deductionMode === RegulationDeductionMode.CUSTOM) {
      const hidden = new Set(regulation.hiddenDeductions ?? []);
      const visibleBuiltIns = DEDUCTION_TYPES_ORDER.filter(
        (t) => !hidden.has(t),
      ).length;
      if (visibleBuiltIns + (regulation.customDeductions ?? []).length === 0) {
        throw new BadRequestException(
          'Mantenha pelo menos um tipo de dedução no regulamento.',
        );
      }
    }

    if (dto.deductionValues) {
      const filtered = this.filterDeductionValues(dto.deductionValues);
      regulation.deductionValues = {
        ...regulation.deductionValues,
        ...filtered,
      };
    }

    const saved = await this.regulationsRepo.save(regulation);
    await this.activityLogService.record(
      saved.aliasId,
      userId,
      EventActivityAction.REGULATION_DEDUCTIONS_UPDATED,
      saved.deductionMode === RegulationDeductionMode.CUSTOM
        ? 'Personalizado'
        : 'IASF',
    );
    return this.toView(eventId, saved);
  }

  async uploadDocument(
    eventId: string,
    kind: RegulationDocumentKind,
    file: Express.Multer.File,
    userId: string,
    name?: string,
  ): Promise<RegulationView> {
    const regulation = await this.getOrCreateForEvent(eventId);

    if (SINGLE_SLOT_DOCUMENT_KINDS.includes(kind)) {
      await this.documentsRepo.delete({ regulationId: regulation.id, kind });
    }

    const fileUrl = await this.storageService.upload(
      file,
      'regulation-documents',
    );
    const document = this.documentsRepo.create({
      regulationId: regulation.id,
      kind,
      name: name || file.originalname,
      fileUrl,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });
    const saved = await this.documentsRepo.save(document);
    await this.activityLogService.record(
      regulation.aliasId,
      userId,
      EventActivityAction.REGULATION_DOCUMENT_UPLOADED,
      saved.name,
    );

    return this.getForEvent(eventId);
  }

  async deleteDocument(
    eventId: string,
    documentId: string,
    userId: string,
  ): Promise<void> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const regulation = await this.regulationsRepo.findOneBy({
      aliasId: event.aliasId,
    });
    if (!regulation) throw new NotFoundException('Documento não encontrado');

    const document = await this.documentsRepo.findOneBy({ id: documentId });
    if (!document || document.regulationId !== regulation.id) {
      throw new NotFoundException('Documento não encontrado');
    }

    await this.documentsRepo.remove(document);
    await this.activityLogService.record(
      regulation.aliasId,
      userId,
      EventActivityAction.REGULATION_DOCUMENT_REMOVED,
      document.name,
    );
  }

  private async getOrCreateForEvent(eventId: string): Promise<Regulation> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const existing = await this.regulationsRepo.findOne({
      where: { aliasId: event.aliasId },
      relations: ['documents'],
    });
    if (existing) return existing;

    const regulation = this.regulationsRepo.create({
      aliasId: event.aliasId,
      deductionMode: RegulationDeductionMode.IASF,
      deductionValues: null,
      customDeductions: null,
      hiddenDeductions: null,
    });
    return this.regulationsRepo.save(regulation);
  }

  // Deduzir = SUBTRAIR. O usuário informa só a magnitude (sinal
  // ignorado), então esquecer o "-" nunca soma pontos à apresentação.
  private toDeductionValue(value: number): number {
    return value === 0 ? 0 : -Math.abs(value);
  }

  private buildCustomDeductions(
    input: NonNullable<UpdateRegulationDto['customDeductions']>,
    existing: CustomDeduction[],
  ): CustomDeduction[] {
    const existingIds = new Set(existing.map((d) => d.id));
    const takenLabels = new Set(
      Object.values(DEDUCTION_LABELS).map((l) => l.toLowerCase()),
    );
    const result: CustomDeduction[] = [];
    for (const item of input) {
      const label = item.label.trim().replace(/\s+/g, ' ');
      if (!label) {
        throw new BadRequestException('O nome da dedução é obrigatório.');
      }
      if (!Number.isFinite(item.value)) {
        throw new BadRequestException(`Valor inválido para "${label}".`);
      }
      const key = label.toLowerCase();
      if (takenLabels.has(key)) {
        throw new BadRequestException(
          `Já existe um tipo de dedução chamado "${label}".`,
        );
      }
      takenLabels.add(key);
      result.push({
        // Só reaproveita um id que já existe (o cliente não inventa ids).
        id:
          item.id && existingIds.has(item.id)
            ? item.id
            : `${CUSTOM_DEDUCTION_PREFIX}${randomUUID()}`,
        label,
        value: this.toDeductionValue(item.value),
      });
    }
    return result;
  }

  // Bloqueia (409) se algum dos tipos (personalizados ou padrão que
  // seriam ocultados) já aparece em nota lançada neste
  // evento — apagar/esconder mudaria a nota de apresentações julgadas.
  private async assertDeductionsNotUsed(
    aliasId: string,
    candidates: Array<{ id: string; label: string }>,
    prefix = 'Não é possível excluir',
  ): Promise<void> {
    if (candidates.length === 0) return;
    const rows: Array<{ type: string }> = await this.regulationsRepo.query(
      `SELECT DISTINCT se.deduction_type AS type
         FROM score_events se
         JOIN schedule_entries e ON e.id::text = se.schedule_entry_id
         JOIN schedule_resources r ON r.id = e.resource_id
         JOIN schedule_days d ON d.id = r.schedule_day_id
        WHERE d.alias_id = $1 AND se.deduction_type = ANY($2)`,
      [aliasId, candidates.map((c) => c.id)],
    );
    if (rows.length === 0) return;
    const used = new Set(rows.map((r) => r.type));
    const names = candidates
      .filter((c) => used.has(c.id))
      .map((c) => `"${c.label}"`)
      .join(', ');
    throw new ConflictException(
      `${prefix}: ${names} já foi usado em notas lançadas neste evento.`,
    );
  }

  private filterDeductionValues(
    values: Record<string, number>,
  ): Partial<Record<DeductionType, number>> {
    const validTypes = new Set<string>(Object.values(DeductionType));
    const filtered: Partial<Record<DeductionType, number>> = {};
    for (const [key, value] of Object.entries(values)) {
      if (
        validTypes.has(key) &&
        typeof value === 'number' &&
        !Number.isNaN(value)
      ) {
        filtered[key as DeductionType] = this.toDeductionValue(value);
      }
    }
    return filtered;
  }

  private toView(
    eventId: string,
    regulation: Regulation | null,
  ): RegulationView {
    const mode = regulation?.deductionMode ?? RegulationDeductionMode.IASF;
    const overrides = regulation?.deductionValues ?? {};

    const hidden = new Set(
      mode === RegulationDeductionMode.CUSTOM
        ? (regulation?.hiddenDeductions ?? [])
        : [],
    );

    const allBuiltIns: DeductionRuleView[] = DEDUCTION_TYPES_ORDER.map(
      (type) => ({
        type,
        label: DEDUCTION_LABELS[type],
        isCustom: false,
        defaultValue: IASF_DEFAULT_DEDUCTIONS[type],
        value:
          mode === RegulationDeductionMode.CUSTOM &&
          overrides[type] !== undefined
            ? overrides[type]
            : IASF_DEFAULT_DEDUCTIONS[type],
      }),
    );

    const deductions = allBuiltIns.filter((d) => !hidden.has(d.type));
    const hiddenDeductions = allBuiltIns.filter((d) => hidden.has(d.type));

    if (mode === RegulationDeductionMode.CUSTOM) {
      for (const custom of regulation?.customDeductions ?? []) {
        deductions.push({
          type: custom.id,
          label: custom.label,
          isCustom: true,
          defaultValue: null,
          value: custom.value,
        });
      }
    }

    return {
      eventId,
      deductionMode: mode,
      deductions,
      hiddenDeductions,
      documents: regulation?.documents ?? [],
      updatedAt: regulation?.updatedAt ?? null,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Regulation } from '../entities/regulation.entity';
import { RegulationDocument } from '../entities/regulation-document.entity';
import { UpdateRegulationDto } from '../dto/update-regulation.dto';
import {
  RegulationDocumentKind,
  SINGLE_SLOT_DOCUMENT_KINDS,
} from '../enums/regulation-document-kind.enum';
import { RegulationDeductionMode } from '../enums/regulation-deduction-mode.enum';
import { DeductionType } from '../enums/deduction-type.enum';
import {
  DEDUCTION_TYPES_ORDER,
  IASF_DEFAULT_DEDUCTIONS,
} from '../constants/iasf-deductions';
import { EventsService } from '../../events/services/events.service';

export interface DeductionRuleView {
  type: DeductionType;
  defaultValue: number;
  value: number;
}

export interface RegulationView {
  eventId: string;
  deductionMode: RegulationDeductionMode;
  deductions: DeductionRuleView[];
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
  ) {}

  async getForEvent(eventId: string): Promise<RegulationView> {
    await this.eventsService.findEventOrThrow(eventId);
    const regulation = await this.regulationsRepo.findOne({
      where: { eventId },
      relations: ['documents'],
    });
    return this.toView(eventId, regulation);
  }

  async updateDeductions(
    eventId: string,
    dto: UpdateRegulationDto,
  ): Promise<RegulationView> {
    const regulation = await this.getOrCreateForEvent(eventId);

    if (dto.deductionMode) {
      regulation.deductionMode = dto.deductionMode;
    }

    if (dto.deductionValues) {
      const filtered = this.filterDeductionValues(dto.deductionValues);
      regulation.deductionValues = {
        ...regulation.deductionValues,
        ...filtered,
      };
    }

    const saved = await this.regulationsRepo.save(regulation);
    return this.toView(eventId, saved);
  }

  async uploadDocument(
    eventId: string,
    kind: RegulationDocumentKind,
    file: Express.Multer.File,
    name?: string,
  ): Promise<RegulationView> {
    const regulation = await this.getOrCreateForEvent(eventId);

    if (SINGLE_SLOT_DOCUMENT_KINDS.includes(kind)) {
      await this.documentsRepo.delete({ regulationId: regulation.id, kind });
    }

    const document = this.documentsRepo.create({
      regulationId: regulation.id,
      kind,
      name: name || file.originalname,
      fileUrl: `/uploads/regulation-documents/${file.filename}`,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });
    await this.documentsRepo.save(document);

    return this.getForEvent(eventId);
  }

  async deleteDocument(eventId: string, documentId: string): Promise<void> {
    const regulation = await this.regulationsRepo.findOneBy({ eventId });
    if (!regulation) throw new NotFoundException('Documento não encontrado');

    const document = await this.documentsRepo.findOneBy({ id: documentId });
    if (!document || document.regulationId !== regulation.id) {
      throw new NotFoundException('Documento não encontrado');
    }

    await this.documentsRepo.remove(document);
  }

  private async getOrCreateForEvent(eventId: string): Promise<Regulation> {
    await this.eventsService.findEventOrThrow(eventId);
    const existing = await this.regulationsRepo.findOne({
      where: { eventId },
      relations: ['documents'],
    });
    if (existing) return existing;

    const regulation = this.regulationsRepo.create({
      eventId,
      deductionMode: RegulationDeductionMode.IASF,
      deductionValues: null,
    });
    return this.regulationsRepo.save(regulation);
  }

  private filterDeductionValues(
    values: Record<string, number>,
  ): Partial<Record<DeductionType, number>> {
    const validTypes = new Set<string>(Object.values(DeductionType));
    const filtered: Partial<Record<DeductionType, number>> = {};
    for (const [key, value] of Object.entries(values)) {
      if (validTypes.has(key) && typeof value === 'number' && !Number.isNaN(value)) {
        filtered[key as DeductionType] = value;
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

    const deductions: DeductionRuleView[] = DEDUCTION_TYPES_ORDER.map(
      (type) => ({
        type,
        defaultValue: IASF_DEFAULT_DEDUCTIONS[type],
        value:
          mode === RegulationDeductionMode.CUSTOM && overrides[type] !== undefined
            ? overrides[type]!
            : IASF_DEFAULT_DEDUCTIONS[type],
      }),
    );

    return {
      eventId,
      deductionMode: mode,
      deductions,
      documents: regulation?.documents ?? [],
      updatedAt: regulation?.updatedAt ?? null,
    };
  }
}

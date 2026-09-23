import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Regulation } from '../entities/regulation.entity';
import { RegulationDocument } from '../entities/regulation-document.entity';
import {
  RegulationDocumentKind,
  SINGLE_SLOT_DOCUMENT_KINDS,
} from '../enums/regulation-document-kind.enum';
import { EventsService } from '../../events/services/events.service';
import { EventActivityLogService } from '../../events/services/event-activity-log.service';
import { EventActivityAction } from '../../events/enums/event-activity-action.enum';
import { StorageService } from '../../common/services/storage.service';

export interface RegulationView {
  eventId: string;
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
    });
    return this.regulationsRepo.save(regulation);
  }

  private toView(
    eventId: string,
    regulation: Regulation | null,
  ): RegulationView {
    return {
      eventId,
      documents: regulation?.documents ?? [],
      updatedAt: regulation?.updatedAt ?? null,
    };
  }
}

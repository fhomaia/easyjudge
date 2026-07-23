import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ScheduleDay } from '../entities/schedule-day.entity';
import { ScheduleResource } from '../entities/schedule-resource.entity';
import { ScheduleEntry } from '../entities/schedule-entry.entity';
import { ScheduleEntryType } from '../enums/schedule-entry-type.enum';
import { ScheduleDistributionStrategy } from '../enums/schedule-distribution-strategy.enum';
import { UpdateScheduleDayDto } from '../dto/update-schedule-day.dto';
import { CreateScheduleResourceDto } from '../dto/create-schedule-resource.dto';
import { UpdateScheduleResourceDto } from '../dto/update-schedule-resource.dto';
import { MoveScheduleResourceDto } from '../dto/move-schedule-resource.dto';
import { CreateScheduleEntryDto } from '../dto/create-schedule-entry.dto';
import { MoveScheduleEntryDto } from '../dto/move-schedule-entry.dto';
import { AutoGenerateScheduleDto } from '../dto/auto-generate-schedule.dto';
import { Team } from '../../teams/entities/team.entity';
import { Category } from '../../categories/entities/category.entity';
import { Event } from '../../events/entities/event.entity';
import { EventsService } from '../../events/services/events.service';
import { stripUndefined } from '../../common/utils/strip-undefined';
import { addDaysToDateString } from '../../common/utils/add-days-to-date-string';

// Não são colunas — o front precisa exibir o nome da equipe/categoria
// no card sem fazer uma chamada extra pra listar programas/times
// (não existe um endpoint "todas as equipes do evento" hoje).
export interface ScheduleEntryView extends ScheduleEntry {
  teamName: string | null;
  categoryName: string | null;
}

export interface ScheduleResourceView extends ScheduleResource {
  entries: ScheduleEntryView[];
}

export interface ScheduleDayView extends ScheduleDay {
  resources: ScheduleResourceView[];
}

export interface UnscheduledPairView {
  teamId: string;
  teamName: string;
  categoryId: string;
  categoryName: string;
  durationMinutes: number;
}

const DEFAULT_COMPONENT_DURATION_MINUTES = 15;

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(ScheduleDay)
    private readonly daysRepo: Repository<ScheduleDay>,
    @InjectRepository(ScheduleResource)
    private readonly resourcesRepo: Repository<ScheduleResource>,
    @InjectRepository(ScheduleEntry)
    private readonly entriesRepo: Repository<ScheduleEntry>,
    @InjectRepository(Team)
    private readonly teamsRepo: Repository<Team>,
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    private readonly eventsService: EventsService,
  ) {}

  async getDays(eventId: string): Promise<ScheduleDayView[]> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    let days = await this.daysRepo.find({
      where: { aliasId: event.aliasId },
      order: { dayIndex: 'ASC' },
    });
    if (days.length === 0) {
      days = await this.seedDays(event);
    }
    return this.hydrateDays(days);
  }

  // Usado por JudgingService pra montar as abas "por dia" da escala de
  // arbitragem (ver painel de jurados): só interessam os dias que já
  // têm apresentação agendada de alguma categoria que usa o sistema de
  // pontuação em questão, e dentro deles só os recursos que aceitam
  // apresentação (não faz sentido escalar jurado pra um recurso de
  // aquecimento). Um recurso é day-scoped (não existe "Pista 1"
  // estável entre dias, ver ScheduleResource) — por isso a atribuição
  // de jurado por recurso também é por dia, não por evento inteiro.
  async findResourcesWithScheduledCategories(
    aliasId: string,
    categoryIds: string[],
  ): Promise<
    Array<{
      id: string;
      date: string;
      dayIndex: number;
      resources: Array<{ id: string; name: string }>;
    }>
  > {
    if (categoryIds.length === 0) return [];
    const days = await this.daysRepo.find({
      where: { aliasId },
      order: { dayIndex: 'ASC' },
    });
    const result: Array<{
      id: string;
      date: string;
      dayIndex: number;
      resources: Array<{ id: string; name: string }>;
    }> = [];
    for (const day of days) {
      const resources = await this.resourcesRepo.find({
        where: { scheduleDayId: day.id, supportsPresentations: true },
        order: { order: 'ASC' },
      });
      const matching: Array<{ id: string; name: string }> = [];
      for (const resource of resources) {
        const scheduledCount = await this.entriesRepo.count({
          where: {
            resourceId: resource.id,
            type: ScheduleEntryType.PRESENTATION,
            categoryId: In(categoryIds),
          },
        });
        if (scheduledCount > 0)
          matching.push({ id: resource.id, name: resource.name });
      }
      if (matching.length > 0) {
        result.push({
          id: day.id,
          date: day.date,
          dayIndex: day.dayIndex,
          resources: matching,
        });
      }
    }
    return result;
  }

  async addDay(eventId: string): Promise<ScheduleDayView> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const existing = await this.daysRepo.find({
      where: { aliasId: event.aliasId },
      order: { dayIndex: 'DESC' },
      take: 1,
    });
    const nextIndex = (existing[0]?.dayIndex ?? 0) + 1;
    const day = await this.createDay(event, nextIndex);
    const [hydrated] = await this.hydrateDays([day]);
    return hydrated;
  }

  // Exclui o dia inteiro — recursos e entries dele saem junto (FK com
  // ON DELETE CASCADE, ver ScheduleResource/ScheduleEntry). Nunca
  // renumera os `dayIndex` dos dias restantes: cada um já guarda sua
  // própria `date`, não é recalculada a partir do índice depois de
  // criado, então deixar buracos no índice é inofensivo (addDay usa o
  // maior índice existente + 1, nunca colide).
  async removeDay(eventId: string, dayId: string): Promise<void> {
    const day = await this.findDayOrThrow(eventId, dayId);
    const totalDays = await this.daysRepo.count({
      where: { aliasId: day.aliasId },
    });
    if (totalDays <= 1) {
      throw new ConflictException(
        'O evento precisa de pelo menos um dia — não é possível excluir o último.',
      );
    }
    await this.daysRepo.remove(day);
  }

  async updateDay(
    eventId: string,
    dayId: string,
    dto: UpdateScheduleDayDto,
  ): Promise<ScheduleDayView> {
    const day = await this.findDayOrThrow(eventId, dayId);
    // defaultWarmupMinutes só vale pra aquecimentos criados DAQUI pra
    // frente por padrão — mas o usuário espera que mudar esse número
    // no cabeçalho também atualize os aquecimentos que já estão
    // agendados (não é só um valor-sugestão pra próxima apresentação).
    const warmupMinutesChanged =
      dto.defaultWarmupMinutes !== undefined &&
      dto.defaultWarmupMinutes !== day.defaultWarmupMinutes;
    Object.assign(day, stripUndefined(dto));
    const saved = await this.daysRepo.save(day);

    if (warmupMinutesChanged) {
      await this.applyWarmupDurationToScheduledEntries(
        dayId,
        saved.defaultWarmupMinutes,
      );
    }

    const [hydrated] = await this.hydrateDays([saved]);
    return hydrated;
  }

  // Muda a duração de todo aquecimento já agendado neste dia pro novo
  // padrão e reconcilia os dois lados afetados pela mudança: o próprio
  // aquecimento pode passar a invadir (ou deixar de invadir) o
  // compromisso de outra equipe ("Aguardando disponibilidade da
  // equipe"), e o fim dele pode passar a cair antes/depois de quando a
  // apresentação correspondente começa ("Aguardando aquecimento", do
  // lado da pista). Repete o par de reconciliações algumas vezes
  // porque uma pode reabrir a necessidade da outra (mesmo raciocínio
  // de `safety` já usado nelas) — não persegue um ponto fixo exato,
  // só o suficiente pro caso comum (poucas equipes/recursos).
  private async applyWarmupDurationToScheduledEntries(
    dayId: string,
    warmupMinutes: number,
  ): Promise<void> {
    const resources = await this.resourcesRepo.find({
      where: { scheduleDayId: dayId },
    });
    const resourceIds = resources.map((r) => r.id);
    if (resourceIds.length === 0) return;

    const warmups = await this.entriesRepo.find({
      where: { resourceId: In(resourceIds), type: ScheduleEntryType.WARMUP },
    });
    if (warmups.length === 0) return;

    for (const warmup of warmups) {
      warmup.durationMinutes = warmupMinutes;
    }
    await this.entriesRepo.save(warmups);

    for (let pass = 0; pass < 3; pass++) {
      await this.reconcileWarmupDelays(dayId);
      await this.reconcileMatGaps(dayId);
    }
  }

  // Recursos são geridos diretamente pelo organizador (CRUD) — sem
  // mais sincronização automática por contagem. `name` é livre; a
  // única flag comportamental é `supportsPresentations` (ver
  // createPresentationWithWarmup).
  async createResource(
    eventId: string,
    dayId: string,
    dto: CreateScheduleResourceDto,
  ): Promise<ScheduleResourceView> {
    const day = await this.findDayOrThrow(eventId, dayId);
    if (dto.pairedResourceId) {
      await this.findResourceOrThrow(day.id, dto.pairedResourceId);
    }
    const count = await this.resourcesRepo.count({
      where: { scheduleDayId: day.id },
    });
    const resource = this.resourcesRepo.create({
      scheduleDayId: day.id,
      name: dto.name,
      color: dto.color ?? null,
      supportsPresentations: dto.supportsPresentations ?? false,
      pairedResourceId: dto.pairedResourceId ?? null,
      order: count,
    });
    const saved = await this.resourcesRepo.save(resource);
    return { ...saved, entries: [] };
  }

  async updateResource(
    eventId: string,
    dayId: string,
    resourceId: string,
    dto: UpdateScheduleResourceDto,
  ): Promise<ScheduleResourceView> {
    await this.findDayOrThrow(eventId, dayId);
    const resource = await this.findResourceOrThrow(dayId, resourceId);

    if (dto.pairedResourceId) {
      if (dto.pairedResourceId === resourceId) {
        throw new BadRequestException(
          'Um recurso não pode ser o próprio aquecimento vinculado.',
        );
      }
      await this.findResourceOrThrow(dayId, dto.pairedResourceId);
    }

    Object.assign(resource, stripUndefined(dto));
    const saved = await this.resourcesRepo.save(resource);
    const entries = await this.entriesRepo.find({
      where: { resourceId: saved.id },
      order: { order: 'ASC' },
    });
    const entryViews = await this.attachNames(entries);
    return { ...saved, entries: entryViews };
  }

  async removeResource(
    eventId: string,
    dayId: string,
    resourceId: string,
  ): Promise<void> {
    await this.findDayOrThrow(eventId, dayId);
    const resource = await this.findResourceOrThrow(dayId, resourceId);
    await this.resourcesRepo.remove(resource);
  }

  async moveResource(
    eventId: string,
    dayId: string,
    resourceId: string,
    dto: MoveScheduleResourceDto,
  ): Promise<ScheduleResourceView[]> {
    await this.findDayOrThrow(eventId, dayId);
    const resource = await this.findResourceOrThrow(dayId, resourceId);

    const siblings = await this.resourcesRepo.find({
      where: { scheduleDayId: dayId },
      order: { order: 'ASC' },
    });
    const filtered = siblings.filter((r) => r.id !== resourceId);
    const insertAt = Math.max(0, Math.min(dto.order, filtered.length));
    filtered.splice(insertAt, 0, resource);
    filtered.forEach((r, idx) => {
      r.order = idx;
    });
    await this.resourcesRepo.save(filtered);

    const [hydrated] = await this.hydrateDays([
      await this.findDayOrThrow(eventId, dayId),
    ]);
    return hydrated.resources;
  }

  // O catálogo de pares equipe/categoria é do evento inteiro (vem dos
  // times inscritos via programa), mas "já agendado" é checado só no
  // dia informado — cada par pode (e deve, num evento de vários dias)
  // ter uma apresentação própria em cada dia, não uma vez só no evento
  // inteiro (ver validateSchedulablePair e replicateToAllDays).
  async getUnscheduled(
    eventId: string,
    dayId: string,
  ): Promise<UnscheduledPairView[]> {
    const day = await this.findDayOrThrow(eventId, dayId);

    const teams = await this.teamsRepo
      .createQueryBuilder('team')
      .innerJoin('team.program', 'program', 'program.aliasId = :aliasId', {
        aliasId: day.aliasId,
      })
      .leftJoinAndSelect('team.categories', 'category')
      .where('program.aliasId = :aliasId', { aliasId: day.aliasId })
      .getMany();

    const scheduled = await this.entriesRepo
      .createQueryBuilder('entry')
      .innerJoin('entry.resource', 'resource')
      .where('resource.scheduleDayId = :dayId', { dayId })
      .andWhere('entry.type = :type', { type: ScheduleEntryType.PRESENTATION })
      .select(['entry.teamId', 'entry.categoryId'])
      .getMany();
    const scheduledKeys = new Set(
      scheduled.map((e) => `${e.teamId}:${e.categoryId}`),
    );

    const pairs: UnscheduledPairView[] = [];
    for (const team of teams) {
      for (const category of team.categories) {
        const key = `${team.id}:${category.id}`;
        if (scheduledKeys.has(key)) continue;
        pairs.push({
          teamId: team.id,
          teamName: team.name,
          categoryId: category.id,
          categoryName: category.name,
          durationMinutes: this.presentationDurationMinutes(category),
        });
      }
    }
    return pairs;
  }

  async createEntry(
    eventId: string,
    dayId: string,
    dto: CreateScheduleEntryDto,
  ): Promise<ScheduleEntryView[]> {
    const day = await this.findDayOrThrow(eventId, dayId);
    const resource = await this.findResourceOrThrow(dayId, dto.resourceId);

    if (dto.type === ScheduleEntryType.WARMUP) {
      throw new BadRequestException(
        'Entradas de aquecimento são criadas automaticamente junto com a apresentação.',
      );
    }

    if (dto.type === ScheduleEntryType.PRESENTATION) {
      const entries = await this.createPresentationWithWarmup(
        day,
        resource,
        dto,
      );
      // Inserir esta apresentação no meio de um recurso já ocupado
      // empurra o que vem depois dela (noutra apresentação/aquecimento
      // já agendado) pra mais tarde — sem reconciliar, o intervalo do
      // par empurrado (aquecimento ou "Aguardando aquecimento") fica
      // com o valor antigo, criando o mesmo tipo de conflito do bug de
      // mover apresentação.
      await this.reconcileWarmupDelays(dayId);
      await this.reconcileMatGaps(dayId);
      return this.attachNames(entries);
    }

    const entry = await this.insertIntoResource(resource.id, dto.order, {
      type: dto.type,
      durationMinutes:
        dto.durationMinutes ?? DEFAULT_COMPONENT_DURATION_MINUTES,
      label: dto.label ?? null,
    });
    // Um componente solto entre um aquecimento e sua apresentação (ou
    // entre dois aquecimentos) empurra tudo que vem depois no mesmo
    // recurso — sem reconciliar os dois lados, o aquecimento pode
    // passar a terminar depois que a apresentação já começou (ver
    // gotcha de "Almoço arrastado pro meio da tabela" no CLAUDE.md).
    await this.reconcileWarmupDelays(dayId);
    await this.reconcileMatGaps(dayId);
    return this.attachNames([entry]);
  }

  async moveEntry(
    eventId: string,
    dayId: string,
    entryId: string,
    dto: MoveScheduleEntryDto,
  ): Promise<ScheduleEntryView> {
    const day = await this.findDayOrThrow(eventId, dayId);
    const entry = await this.findEntryInDayOrThrow(dayId, entryId);

    // Mover a apresentação arrasta o aquecimento (e os intervalos de
    // espera vinculados) junto, recalculando a posição de tudo — sem
    // isso, o usuário podia arrastar só a apresentação pra um horário
    // que não dá tempo do aquecimento terminar antes (ou que sobrepõe
    // outro compromisso da equipe), criando exatamente o tipo de
    // conflito que createPresentationWithWarmup já evita na criação.
    // Aquecimento sozinho continua um move simples (não tenta puxar a
    // apresentação atrás) — o usuário pode reposicionar o aquecimento
    // de forma independente sem afetar quando a equipe se apresenta.
    if (entry.type === ScheduleEntryType.PRESENTATION) {
      return this.movePresentationWithWarmup(day, entry, dto);
    }

    await this.findResourceOrThrow(dayId, dto.resourceId);
    const oldResourceId = entry.resourceId;

    const siblings = await this.entriesRepo.find({
      where: { resourceId: dto.resourceId },
      order: { order: 'ASC' },
    });
    const filtered = siblings.filter((s) => s.id !== entryId);
    const insertAt = Math.max(0, Math.min(dto.order, filtered.length));
    entry.resourceId = dto.resourceId;
    filtered.splice(insertAt, 0, entry);
    filtered.forEach((e, idx) => {
      e.order = idx;
    });
    await this.entriesRepo.save(filtered);

    if (oldResourceId !== dto.resourceId) {
      await this.renumberResource(oldResourceId);
    }
    await this.reconcileWarmupDelays(dayId);
    const updated = await this.entriesRepo.findOneBy({ id: entryId });
    const [view] = await this.attachNames([updated!]);
    return view;
  }

  // Remove a apresentação (e o grupo inteiro vinculado a ela — mesma
  // resolução do removeEntry) e a recria na posição pedida via
  // createPresentationWithWarmup, que já sabe calcular aquecimento e
  // intervalos de espera corretos pra qualquer posição nova — reusar
  // essa lógica evita duplicar as regras de "não sobrepor a equipe" e
  // "aquecimento sempre termina a tempo" para o caso de mover.
  private async movePresentationWithWarmup(
    day: ScheduleDay,
    presentation: ScheduleEntry,
    dto: MoveScheduleEntryDto,
  ): Promise<ScheduleEntryView> {
    const targetResource = await this.findResourceOrThrow(
      day.id,
      dto.resourceId,
    );
    if (!targetResource.supportsPresentations) {
      throw new BadRequestException(
        'Este recurso não aceita apresentações — habilite "Aceita apresentações" em Gerenciar recursos.',
      );
    }

    const linkedEntries = await this.entriesRepo.find({
      where: { linkedEntryId: presentation.id },
    });
    const affectedResourceIds = new Set<string>([presentation.resourceId]);
    for (const e of linkedEntries) affectedResourceIds.add(e.resourceId);

    const teamId = presentation.teamId!;
    const categoryId = presentation.categoryId!;
    const durationMinutes = presentation.durationMinutes;

    for (const e of linkedEntries) {
      await this.entriesRepo.remove(e);
    }
    await this.entriesRepo.remove(presentation);
    for (const resourceId of affectedResourceIds) {
      await this.renumberResource(resourceId);
    }

    // Reconcilia ANTES de recriar — remover este grupo pode ter
    // deixado a espera de OUTRA equipe/categoria (que existia só pra
    // esperar a apresentação que acabou de sair do lugar) obsoleta.
    // Sem isso, createPresentationWithWarmup calcularia a posição da
    // nova apresentação em cima desse estado ainda desatualizado
    // (`naturalWarmupStart` inflado pela espera órfã), concluindo
    // "sem atraso necessário" quando na verdade precisa de um — só
    // reconciliar de novo no final não bastava porque isso arruma o
    // aquecimento sem re-checar o intervalo correspondente do lado da
    // pista, deixando o conflito remontado mesmo depois do ajuste.
    await this.reconcileWarmupDelays(day.id);

    const [newPresentation] = await this.createPresentationWithWarmup(
      day,
      targetResource,
      {
        resourceId: dto.resourceId,
        type: ScheduleEntryType.PRESENTATION,
        order: dto.order,
        teamId,
        categoryId,
        durationMinutes,
      },
    );

    await this.reconcileWarmupDelays(day.id);

    const [view] = await this.attachNames([newPresentation]);
    return view;
  }

  async removeEntry(
    eventId: string,
    dayId: string,
    entryId: string,
  ): Promise<void> {
    await this.findDayOrThrow(eventId, dayId);
    const entry = await this.findEntryInDayOrThrow(dayId, entryId);

    // Intervalos "Aguardando aquecimento"/"Aguardando disponibilidade
    // da equipe" são gerados automaticamente pra evitar um conflito de
    // agenda real (a equipe se apresentando e se aquecendo ao mesmo
    // tempo) — só eles têm linkedEntryId apontando pra uma presentation
    // sem eles mesmos serem presentation/warmup. Removê-los sozinhos
    // (sem remover a apresentação/aquecimento que os originou) reabre
    // o conflito que existiam pra evitar, e diferente de removeEntry
    // "normal", não tem como a reconciliação recriar um intervalo que
    // falta (só ajusta/remove os que já existem) — ficaria sem jeito
    // de consertar pela UI. Só sai removendo a apresentação
    // correspondente (que aí sim limpa o grupo inteiro).
    if (entry.type === ScheduleEntryType.BREAK && entry.linkedEntryId) {
      throw new BadRequestException(
        'Este intervalo é gerado automaticamente para evitar conflito de agenda da equipe — remova a apresentação correspondente para removê-lo.',
      );
    }

    // A apresentação é o "centro" do grupo — aquecimento e os
    // intervalos de espera criados pra encaixar os dois (ver
    // createPresentationWithWarmup/autoGenerate) todos apontam
    // linkedEntryId pra ela. Resolver sempre pro id da apresentação,
    // mesmo removendo a partir do aquecimento, permite limpar o grupo
    // inteiro (aquecimento + "Aguardando aquecimento" + "Aguardando
    // disponibilidade da equipe") em uma consulta só — excluir a
    // apresentação sem eles deixaria buracos órfãos na timeline que
    // dessincronizam o horário do resto do dia.
    let presentationId: string | null = null;
    if (entry.type === ScheduleEntryType.PRESENTATION) {
      presentationId = entry.id;
    } else if (entry.type === ScheduleEntryType.WARMUP && entry.linkedEntryId) {
      presentationId = entry.linkedEntryId;
    }

    if (presentationId) {
      const linkedEntries = await this.entriesRepo.find({
        where: { linkedEntryId: presentationId },
      });
      const resourceIds = new Set<string>();
      for (const linked of linkedEntries) {
        if (linked.id === entryId) continue; // já removida no final da função
        resourceIds.add(linked.resourceId);
        await this.entriesRepo.remove(linked);
      }
      if (presentationId !== entryId) {
        const presentation = await this.entriesRepo.findOneBy({
          id: presentationId,
        });
        if (presentation) {
          resourceIds.add(presentation.resourceId);
          await this.entriesRepo.remove(presentation);
        }
      }
      for (const resourceId of resourceIds) {
        await this.renumberResource(resourceId);
      }
    }

    const resourceId = entry.resourceId;
    await this.entriesRepo.remove(entry);
    await this.renumberResource(resourceId);
    await this.reconcileWarmupDelays(dayId);
  }

  async autoGenerate(
    eventId: string,
    dayId: string,
    dto: AutoGenerateScheduleDto,
  ): Promise<ScheduleDayView> {
    const day = await this.findDayOrThrow(eventId, dayId);
    const mats = await this.resourcesRepo.find({
      where: { scheduleDayId: day.id, supportsPresentations: true },
      order: { order: 'ASC' },
    });
    if (mats.length === 0) {
      throw new ConflictException(
        'Nenhum recurso deste dia aceita apresentações — configure ao menos um em "Gerenciar recursos".',
      );
    }

    const dayResources = await this.resourcesRepo.find({
      where: { scheduleDayId: day.id },
    });
    const dayResourceIds = dayResources.map((r) => r.id);
    if (dayResourceIds.length > 0) {
      await this.entriesRepo.delete({ resourceId: In(dayResourceIds) });
    }

    const unscheduled = await this.getUnscheduled(eventId, day.id);
    const buckets: UnscheduledPairView[][] = mats.map(() => []);

    if (dto.distribution === ScheduleDistributionStrategy.SEQUENTIAL) {
      const perMat = Math.ceil(unscheduled.length / mats.length) || 1;
      unscheduled.forEach((pair, idx) => {
        const bucketIndex = Math.min(mats.length - 1, Math.floor(idx / perMat));
        buckets[bucketIndex].push(pair);
      });
    } else {
      unscheduled.forEach((pair, idx) => {
        buckets[idx % mats.length].push(pair);
      });
    }

    for (let m = 0; m < mats.length; m++) {
      const mat = mats[m];
      const warmupCandidates = await this.resourcesRepo.find({
        where: { scheduleDayId: day.id, pairedResourceId: mat.id },
        order: { order: 'ASC' },
      });
      if (warmupCandidates.length === 0) {
        throw new ConflictException(
          `Nenhuma área de aquecimento está vinculada a "${mat.name}" — vincule uma em "Editar recurso" na área de aquecimento.`,
        );
      }
      // Um aquecimento por candidato — pode haver mais de uma área de
      // aquecimento vinculada à mesma pista (evento grande); a cada
      // par, escolhe a que estiver mais livre (menor acumulado).
      const warmupElapsedByResource = new Map<string, number>(
        warmupCandidates.map((w) => [w.id, 0]),
      );

      let matOrder = 0;
      let matElapsed = 0;
      let lunchInserted = false;

      for (const pair of buckets[m]) {
        if (
          !lunchInserted &&
          dto.lunchDurationMinutes > 0 &&
          day.startMinutes + matElapsed >= dto.lunchStartMinutes
        ) {
          await this.insertIntoResource(mat.id, matOrder++, {
            type: ScheduleEntryType.BREAK,
            durationMinutes: dto.lunchDurationMinutes,
            label: 'Almoço',
          });
          matElapsed += dto.lunchDurationMinutes;
          for (const warmupResource of warmupCandidates) {
            await this.insertIntoResource(
              warmupResource.id,
              Number.MAX_SAFE_INTEGER,
              {
                type: ScheduleEntryType.BREAK,
                durationMinutes: dto.lunchDurationMinutes,
                label: 'Almoço',
              },
            );
            warmupElapsedByResource.set(
              warmupResource.id,
              (warmupElapsedByResource.get(warmupResource.id) ?? 0) +
                dto.lunchDurationMinutes,
            );
          }
          lunchInserted = true;
        }

        let chosenWarmupId = warmupCandidates[0].id;
        let chosenElapsed = warmupElapsedByResource.get(chosenWarmupId)!;
        for (const candidate of warmupCandidates.slice(1)) {
          const elapsed = warmupElapsedByResource.get(candidate.id)!;
          if (elapsed < chosenElapsed) {
            chosenWarmupId = candidate.id;
            chosenElapsed = elapsed;
          }
        }

        // Mesma checagem de disponibilidade da equipe usada na criação
        // manual (ver createPresentationWithWarmup) — sem isso, uma
        // equipe com mais de uma apresentação no dia podia ter o
        // aquecimento de uma categoria caindo em cima da apresentação
        // de outra. `insertIntoResource` já persiste no banco a cada
        // chamada, então essa consulta reflete tudo que já foi
        // agendado até este ponto do loop (inclusive em outras pistas).
        const teamBusyWindows = await this.getTeamBusyWindows(day, pair.teamId);
        const naturalWarmupStart = day.startMinutes + chosenElapsed;
        const resolvedWarmupStart = this.resolveNonOverlappingStart(
          naturalWarmupStart,
          dto.warmupMinutes,
          teamBusyWindows,
        );
        const warmupDelayMinutes = resolvedWarmupStart - naturalWarmupStart;
        if (warmupDelayMinutes > 0) {
          chosenElapsed += warmupDelayMinutes;
          warmupElapsedByResource.set(chosenWarmupId, chosenElapsed);
        }

        const warmupEndAfterThisPair = chosenElapsed + dto.warmupMinutes;
        const needsMatGap = warmupEndAfterThisPair > matElapsed;
        const matGapMinutes = needsMatGap
          ? warmupEndAfterThisPair - matElapsed
          : 0;
        if (needsMatGap) matElapsed += matGapMinutes;

        // Cria a apresentação primeiro (posição provisória — os
        // intervalos de espera abaixo entram na mesma posição logo em
        // seguida, empurrando-a um lugar adiante) pra poder vincular os
        // intervalos a ela via linkedEntryId, mesma técnica de
        // createPresentationWithWarmup — sem isso, removeEntry não
        // consegue limpar os intervalos junto quando a apresentação é
        // removida (ver gotcha de dessincronia de horário).
        const presentation = await this.insertIntoResource(mat.id, matOrder, {
          type: ScheduleEntryType.PRESENTATION,
          durationMinutes: pair.durationMinutes,
          teamId: pair.teamId,
          categoryId: pair.categoryId,
        });

        if (warmupDelayMinutes > 0) {
          await this.insertIntoResource(
            chosenWarmupId,
            Number.MAX_SAFE_INTEGER,
            {
              type: ScheduleEntryType.BREAK,
              durationMinutes: warmupDelayMinutes,
              label: 'Aguardando disponibilidade da equipe',
              linkedEntryId: presentation.id,
            },
          );
        }

        if (needsMatGap) {
          await this.insertIntoResource(mat.id, matOrder, {
            type: ScheduleEntryType.BREAK,
            durationMinutes: matGapMinutes,
            label: 'Aguardando aquecimento',
            linkedEntryId: presentation.id,
          });
          matOrder++;
        }
        matOrder++; // consumido pela apresentação em si

        await this.insertIntoResource(chosenWarmupId, Number.MAX_SAFE_INTEGER, {
          type: ScheduleEntryType.WARMUP,
          durationMinutes: dto.warmupMinutes,
          teamId: pair.teamId,
          categoryId: pair.categoryId,
          linkedEntryId: presentation.id,
        });

        matElapsed += pair.durationMinutes;
        warmupElapsedByResource.set(
          chosenWarmupId,
          chosenElapsed + dto.warmupMinutes,
        );
      }
    }

    const [hydrated] = await this.hydrateDays([day]);
    return hydrated;
  }

  // Copia o horário do dia (início/fim, tempo padrão de aquecimento),
  // a estrutura de recursos (pistas/aquecimentos, com nome, cor e
  // pareamento) E todas as entries (apresentação, aquecimento,
  // componentes, intervalos automáticos) do dia de origem pra todos os
  // outros dias do evento — pensado pra eventos de vários dias em que
  // as mesmas equipes se apresentam em cada dia (ex: eliminatória +
  // final), evitando reconfigurar tudo na mão em cada dia novo.
  //
  // Cada equipe/categoria passa a ter uma apresentação própria POR DIA
  // (não uma vez só no evento inteiro — ver validateSchedulablePair),
  // então clonar a apresentação do dia de origem pro dia de destino é
  // válido: não é a "mesma" apresentação se repetindo, é uma nova,
  // naquele dia, pra aquela equipe/categoria.
  //
  // Destrutivo no destino por design (o usuário confirmou essa opção
  // explicitamente, com popup de confirmação no frontend): os recursos
  // atuais de cada dia de destino são apagados antes de receber a
  // cópia (cascade já cuida das entries deles).
  async replicateToAllDays(
    eventId: string,
    sourceDayId: string,
  ): Promise<ScheduleDayView[]> {
    const sourceDay = await this.findDayOrThrow(eventId, sourceDayId);

    const allDays = await this.daysRepo.find({
      where: { aliasId: sourceDay.aliasId },
      order: { dayIndex: 'ASC' },
    });
    const targetDays = allDays.filter((d) => d.id !== sourceDayId);
    if (targetDays.length === 0) {
      throw new ConflictException(
        'Este evento só tem um dia — adicione outro dia antes de replicar o cronograma.',
      );
    }

    const sourceResources = await this.resourcesRepo.find({
      where: { scheduleDayId: sourceDayId },
      order: { order: 'ASC' },
    });
    const entriesByResource = new Map<string, ScheduleEntry[]>();
    for (const resource of sourceResources) {
      const entries = await this.entriesRepo.find({
        where: { resourceId: resource.id },
        order: { order: 'ASC' },
      });
      entriesByResource.set(resource.id, entries);
    }

    for (const targetDay of targetDays) {
      // Muta o próprio objeto (referência que já está dentro de
      // `allDays`) em vez de só `daysRepo.update` — `hydrateDays`, no
      // final desta função, monta a resposta a partir dos objetos de
      // `allDays` como estão em memória, sem re-buscar do banco; só
      // dar `update` deixaria a resposta da API com os valores antigos
      // mesmo com o banco já correto.
      targetDay.startMinutes = sourceDay.startMinutes;
      targetDay.endMinutes = sourceDay.endMinutes;
      targetDay.defaultWarmupMinutes = sourceDay.defaultWarmupMinutes;
      await this.daysRepo.save(targetDay);

      const targetResources = await this.resourcesRepo.find({
        where: { scheduleDayId: targetDay.id },
      });
      if (targetResources.length > 0) {
        await this.resourcesRepo.remove(targetResources);
      }

      const resourceIdMap = new Map<string, string>();
      for (const sr of sourceResources) {
        const created = await this.resourcesRepo.save(
          this.resourcesRepo.create({
            scheduleDayId: targetDay.id,
            name: sr.name,
            color: sr.color,
            supportsPresentations: sr.supportsPresentations,
            order: sr.order,
          }),
        );
        resourceIdMap.set(sr.id, created.id);
      }
      for (const sr of sourceResources) {
        if (!sr.pairedResourceId) continue;
        const pairedNewId = resourceIdMap.get(sr.pairedResourceId);
        if (!pairedNewId) continue;
        await this.resourcesRepo.update(resourceIdMap.get(sr.id)!, {
          pairedResourceId: pairedNewId,
        });
      }

      // Clona todas as entries primeiro sem linkedEntryId (o id novo
      // do "outro lado" do vínculo — presentation<->warmup ou
      // apresentação<->intervalo de espera — só existe depois que
      // todo mundo já foi criado), guardando o mapa id antigo -> id
      // novo pra resolver o vínculo na segunda passada.
      const entryIdMap = new Map<string, string>();
      const pendingLinks: { newEntryId: string; oldLinkedEntryId: string }[] =
        [];
      for (const sr of sourceResources) {
        const newResourceId = resourceIdMap.get(sr.id)!;
        const entries = entriesByResource.get(sr.id) ?? [];
        for (const entry of entries) {
          const created = await this.entriesRepo.save(
            this.entriesRepo.create({
              resourceId: newResourceId,
              type: entry.type,
              order: entry.order,
              durationMinutes: entry.durationMinutes,
              teamId: entry.teamId,
              categoryId: entry.categoryId,
              label: entry.label,
            }),
          );
          entryIdMap.set(entry.id, created.id);
          if (entry.linkedEntryId) {
            pendingLinks.push({
              newEntryId: created.id,
              oldLinkedEntryId: entry.linkedEntryId,
            });
          }
        }
      }
      for (const { newEntryId, oldLinkedEntryId } of pendingLinks) {
        const newLinkedId = entryIdMap.get(oldLinkedEntryId);
        if (newLinkedId) {
          await this.entriesRepo.update(newEntryId, {
            linkedEntryId: newLinkedId,
          });
        }
      }
    }

    return this.hydrateDays(allDays);
  }

  private async createPresentationWithWarmup(
    day: ScheduleDay,
    resource: ScheduleResource,
    dto: CreateScheduleEntryDto,
  ): Promise<ScheduleEntry[]> {
    if (!dto.teamId || !dto.categoryId) {
      throw new BadRequestException(
        'teamId e categoryId são obrigatórios para agendar uma apresentação.',
      );
    }
    if (!resource.supportsPresentations) {
      throw new BadRequestException(
        'Este recurso não aceita apresentações — habilite "Aceita apresentações" em Gerenciar recursos.',
      );
    }

    const { category } = await this.validateSchedulablePair(
      day.aliasId,
      day.id,
      dto.teamId,
      dto.categoryId,
    );
    const teamId = dto.teamId;
    const durationMinutes =
      dto.durationMinutes ?? this.presentationDurationMinutes(category);
    const warmupDurationMinutes = day.defaultWarmupMinutes;

    const warmupResource = await this.getAvailableWarmupResourceForMat(
      day,
      resource,
    );
    const warmupSiblings = await this.entriesRepo.find({
      where: { resourceId: warmupResource.id },
      order: { order: 'ASC' },
    });
    // Posição natural do aquecimento — sempre entra no fim da fila
    // daquele recurso.
    const naturalWarmupStart =
      day.startMinutes +
      warmupSiblings.reduce((sum, e) => sum + e.durationMinutes, 0);

    // A mesma equipe não pode estar se aquecendo pra esta categoria
    // enquanto apresenta (ou se aquece) em outra — se a posição natural
    // cairia dentro de algum compromisso já agendado da equipe em
    // qualquer lugar do dia, atrasa o aquecimento com um intervalo
    // automático até a equipe estar livre.
    const teamBusyWindows = await this.getTeamBusyWindows(day, teamId);
    const warmupStart = this.resolveNonOverlappingStart(
      naturalWarmupStart,
      warmupDurationMinutes,
      teamBusyWindows,
    );
    const warmupDelayMinutes = warmupStart - naturalWarmupStart;
    const warmupEndMinutes = warmupStart + warmupDurationMinutes;

    const matSiblings = await this.entriesRepo.find({
      where: { resourceId: resource.id },
      order: { order: 'ASC' },
    });
    const insertAt = Math.max(0, Math.min(dto.order, matSiblings.length));
    const presentationStartMinutes =
      day.startMinutes +
      matSiblings
        .slice(0, insertAt)
        .reduce((sum, e) => sum + e.durationMinutes, 0);

    // Se o aquecimento (que vai terminar em warmupEndMinutes) ainda
    // estaria em andamento quando a apresentação começaria, um
    // intervalo automático entra na frente dela, na pista, do tamanho
    // exato da folga que falta — resolve o conflito sem precisar de
    // ajuste manual.
    const needsMatGap = warmupEndMinutes > presentationStartMinutes;
    const matGapMinutes = needsMatGap
      ? warmupEndMinutes - presentationStartMinutes
      : 0;

    // Cria a apresentação primeiro, em posição provisória (se houver
    // intervalo de espera, ele entra na mesma posição logo abaixo,
    // empurrando-a um lugar adiante) — só assim dá pra vincular os
    // intervalos a ela via linkedEntryId. Sem isso, removeEntry não
    // consegue limpar os intervalos junto quando a apresentação é
    // removida, deixando buracos órfãos que dessincronizam o horário
    // do resto do dia (ver gotcha no CLAUDE.md).
    const presentation = await this.insertIntoResource(resource.id, insertAt, {
      type: ScheduleEntryType.PRESENTATION,
      durationMinutes,
      teamId,
      categoryId: dto.categoryId,
    });

    if (warmupDelayMinutes > 0) {
      await this.insertIntoResource(warmupResource.id, warmupSiblings.length, {
        type: ScheduleEntryType.BREAK,
        durationMinutes: warmupDelayMinutes,
        label: 'Aguardando disponibilidade da equipe',
        linkedEntryId: presentation.id,
      });
    }

    if (needsMatGap) {
      await this.insertIntoResource(resource.id, insertAt, {
        type: ScheduleEntryType.BREAK,
        durationMinutes: matGapMinutes,
        label: 'Aguardando aquecimento',
        linkedEntryId: presentation.id,
      });
    }

    const warmupOrder =
      warmupSiblings.length + (warmupDelayMinutes > 0 ? 1 : 0);
    const warmup = await this.insertIntoResource(
      warmupResource.id,
      warmupOrder,
      {
        type: ScheduleEntryType.WARMUP,
        durationMinutes: warmupDurationMinutes,
        teamId,
        categoryId: dto.categoryId,
        linkedEntryId: presentation.id,
      },
    );

    return [presentation, warmup];
  }

  // Todas as janelas [início,fim] em que a equipe já está comprometida
  // neste dia (apresentando ou se aquecendo em qualquer recurso) —
  // usado pra não deixar um aquecimento novo começar durante um
  // compromisso já existente da mesma equipe. `excludeEntryIds` tira
  // da conta as próprias entries do grupo que está sendo posicionado
  // (usado por reconcileWarmupDelays, que reavalia um aquecimento já
  // existente — sem excluir, ele sempre "colidiria" consigo mesmo).
  private async getTeamBusyWindows(
    day: ScheduleDay,
    teamId: string,
    excludeEntryIds?: ReadonlySet<string>,
  ): Promise<{ start: number; end: number }[]> {
    const resources = await this.resourcesRepo.find({
      where: { scheduleDayId: day.id },
    });
    const resourceIds = resources.map((r) => r.id);
    const allEntries = resourceIds.length
      ? await this.entriesRepo.find({ where: { resourceId: In(resourceIds) } })
      : [];

    const windows: { start: number; end: number }[] = [];
    for (const resource of resources) {
      const entries = allEntries
        .filter((e) => e.resourceId === resource.id)
        .sort((a, b) => a.order - b.order);
      let cursor = day.startMinutes;
      for (const entry of entries) {
        const start = cursor;
        const end = start + entry.durationMinutes;
        if (entry.teamId === teamId && !excludeEntryIds?.has(entry.id)) {
          windows.push({ start, end });
        }
        cursor = end;
      }
    }
    return windows;
  }

  // Depois de remover uma apresentação/aquecimento, qualquer intervalo
  // "Aguardando disponibilidade da equipe" no dia (de qualquer equipe,
  // não só a do que foi removido — outra equipe podia estar esperando
  // por causa da agora removida) pode ter deixado de fazer sentido, ou
  // precisar de um tamanho diferente: ele foi calculado uma vez, na
  // hora da criação, e nunca mais revisado. Sem essa reconciliação, o
  // intervalo antigo fica parado no lugar — exatamente o bug relatado
  // (excluir a 1ª de duas apresentações seguidas da mesma equipe não
  // limpava a espera calculada pra 2ª, que ficava esperando por uma
  // apresentação que não existe mais e conflitando com a nova posição
  // do aquecimento/apresentação seguinte).
  //
  // Passada única por recurso de aquecimento (não persegue efeitos em
  // cascata entre recursos diferentes) — suficiente pro caso relatado
  // e pro uso comum; um cenário bem mais raro (3+ apresentações da
  // mesma equipe intercaladas em recursos diferentes) pode ainda
  // deixar uma espera desatualizada até o usuário mexer de novo
  // naquele dia.
  private async reconcileWarmupDelays(dayId: string): Promise<void> {
    const day = await this.daysRepo.findOneBy({ id: dayId });
    if (!day) return;
    const resources = await this.resourcesRepo.find({
      where: { scheduleDayId: dayId },
    });
    const warmupResources = resources.filter((r) => !r.supportsPresentations);

    for (const resource of warmupResources) {
      let safety = 0;
      // Reinicia do começo do recurso sempre que uma espera é
      // removida/ajustada/inserida (a lista de entries muda), até não
      // sobrar mais nenhuma pra corrigir — `safety` só evita loop
      // infinito se algo inesperado deixar de convergir.
      while (safety++ < 50) {
        const entries = await this.entriesRepo.find({
          where: { resourceId: resource.id },
          order: { order: 'ASC' },
        });
        let elapsed = 0;
        let changed = false;
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          if (entry.type !== ScheduleEntryType.WARMUP || !entry.teamId) {
            elapsed += entry.durationMinutes;
            continue;
          }

          // Só conta como "a espera deste aquecimento" se apontar pra
          // mesma apresentação que o aquecimento aponta — evita
          // confundir com um intervalo qualquer que aconteça de
          // preceder este aquecimento por outro motivo.
          const prev = i > 0 ? entries[i - 1] : null;
          const prevIsDelay =
            !!prev &&
            prev.type === ScheduleEntryType.BREAK &&
            prev.label === 'Aguardando disponibilidade da equipe' &&
            prev.linkedEntryId === entry.linkedEntryId;

          const naturalStart =
            day.startMinutes +
            (prevIsDelay ? elapsed - prev.durationMinutes : elapsed);
          const excludeIds = new Set([entry.id]);
          if (prevIsDelay) excludeIds.add(prev.id);
          const busyWindows = await this.getTeamBusyWindows(
            day,
            entry.teamId,
            excludeIds,
          );
          const resolvedStart = this.resolveNonOverlappingStart(
            naturalStart,
            entry.durationMinutes,
            busyWindows,
          );
          const requiredDelay = resolvedStart - naturalStart;

          if (prevIsDelay) {
            if (requiredDelay <= 0) {
              await this.entriesRepo.remove(prev);
              await this.renumberResource(resource.id);
              changed = true;
              break;
            }
            if (requiredDelay !== prev.durationMinutes) {
              prev.durationMinutes = requiredDelay;
              await this.entriesRepo.save(prev);
              changed = true;
              break;
            }
          } else if (requiredDelay > 0 && entry.linkedEntryId) {
            // Não existia espera nenhuma antes deste aquecimento, mas
            // agora precisa de uma — acontece, por exemplo, quando o
            // tempo de aquecimento do dia diminui e os intervalos
            // "Aguardando aquecimento" do lado da pista encolhem,
            // fazendo uma apresentação de outra categoria da mesma
            // equipe cair mais cedo e passar a colidir com este
            // aquecimento (ver applyWarmupDurationToScheduledEntries).
            await this.insertIntoResource(resource.id, i, {
              type: ScheduleEntryType.BREAK,
              durationMinutes: requiredDelay,
              label: 'Aguardando disponibilidade da equipe',
              linkedEntryId: entry.linkedEntryId,
            });
            changed = true;
            break;
          }

          elapsed += entry.durationMinutes;
        }
        if (!changed) break;
      }
    }
  }

  // Horário [início,fim] de cada entry de UM recurso só, computado do
  // mesmo jeito que o frontend faz (soma sequencial de
  // durationMinutes a partir do início do dia) — usado por
  // reconcileMatGaps pra saber quando o aquecimento de outro recurso
  // termina de verdade, sem precisar reimplementar o cálculo de
  // getTeamBusyWindows (que devolve só as janelas de UMA equipe, não
  // o horário de uma entry específica).
  private async getResourceEntryTimes(
    resourceId: string,
    dayStartMinutes: number,
  ): Promise<Map<string, { start: number; end: number }>> {
    const entries = await this.entriesRepo.find({
      where: { resourceId },
      order: { order: 'ASC' },
    });
    const times = new Map<string, { start: number; end: number }>();
    let cursor = dayStartMinutes;
    for (const entry of entries) {
      times.set(entry.id, {
        start: cursor,
        end: cursor + entry.durationMinutes,
      });
      cursor += entry.durationMinutes;
    }
    return times;
  }

  // Espelho de reconcileWarmupDelays do lado da pista: depois que um
  // aquecimento muda de duração (ou de horário), o intervalo
  // "Aguardando aquecimento" que antecede a apresentação correspondente
  // pode ter ficado maior/menor que o necessário, deixado de ser
  // necessário, ou passado a ser necessário quando antes não era.
  // Ajusta, remove ou insere esse intervalo pra cada apresentação de
  // cada recurso que aceita apresentações.
  private async reconcileMatGaps(dayId: string): Promise<void> {
    const day = await this.daysRepo.findOneBy({ id: dayId });
    if (!day) return;
    const resources = await this.resourcesRepo.find({
      where: { scheduleDayId: dayId },
    });
    const matResources = resources.filter((r) => r.supportsPresentations);

    for (const resource of matResources) {
      let safety = 0;
      while (safety++ < 50) {
        const entries = await this.entriesRepo.find({
          where: { resourceId: resource.id },
          order: { order: 'ASC' },
        });
        let elapsed = 0;
        let changed = false;
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          if (entry.type !== ScheduleEntryType.PRESENTATION) {
            elapsed += entry.durationMinutes;
            continue;
          }

          const warmup = await this.entriesRepo.findOneBy({
            linkedEntryId: entry.id,
            type: ScheduleEntryType.WARMUP,
          });
          if (!warmup) {
            elapsed += entry.durationMinutes;
            continue;
          }

          const prev = i > 0 ? entries[i - 1] : null;
          const prevIsGap =
            !!prev &&
            prev.type === ScheduleEntryType.BREAK &&
            prev.label === 'Aguardando aquecimento' &&
            prev.linkedEntryId === entry.id;

          const warmupTimes = await this.getResourceEntryTimes(
            warmup.resourceId,
            day.startMinutes,
          );
          const warmupEnd = warmupTimes.get(warmup.id)?.end ?? day.startMinutes;
          const naturalPresentationStart =
            day.startMinutes +
            (prevIsGap ? elapsed - prev.durationMinutes : elapsed);
          const requiredGap = Math.max(0, warmupEnd - naturalPresentationStart);

          if (prevIsGap) {
            if (requiredGap <= 0) {
              await this.entriesRepo.remove(prev);
              await this.renumberResource(resource.id);
              changed = true;
              break;
            }
            if (requiredGap !== prev.durationMinutes) {
              prev.durationMinutes = requiredGap;
              await this.entriesRepo.save(prev);
              changed = true;
              break;
            }
          } else if (requiredGap > 0) {
            await this.insertIntoResource(resource.id, i, {
              type: ScheduleEntryType.BREAK,
              durationMinutes: requiredGap,
              label: 'Aguardando aquecimento',
              linkedEntryId: entry.id,
            });
            changed = true;
            break;
          }

          elapsed += entry.durationMinutes;
        }
        if (!changed) break;
      }
    }
  }

  // Empurra `candidateStart` pra depois de qualquer janela ocupada que
  // ele invadiria — repete até estabilizar, já que escapar de uma
  // janela pode cair dentro de outra mais adiante.
  private resolveNonOverlappingStart(
    candidateStart: number,
    duration: number,
    busyWindows: { start: number; end: number }[],
  ): number {
    let start = candidateStart;
    let changed = true;
    while (changed) {
      changed = false;
      for (const window of busyWindows) {
        const end = start + duration;
        const overlaps = start < window.end && window.start < end;
        if (overlaps) {
          start = window.end;
          changed = true;
        }
      }
    }
    return start;
  }

  private async validateSchedulablePair(
    aliasId: string,
    dayId: string,
    teamId: string,
    categoryId: string,
  ): Promise<{ team: Team; category: Category }> {
    const category = await this.categoriesRepo.findOneBy({
      id: categoryId,
      aliasId,
    });
    if (!category) throw new NotFoundException('Categoria não encontrada');

    const team = await this.teamsRepo
      .createQueryBuilder('team')
      .innerJoin('team.program', 'program', 'program.aliasId = :aliasId', {
        aliasId,
      })
      .innerJoin('team.categories', 'category', 'category.id = :categoryId', {
        categoryId,
      })
      .where('team.id = :teamId', { teamId })
      .getOne();
    if (!team) {
      throw new NotFoundException(
        'Essa equipe não está inscrita nessa categoria neste evento.',
      );
    }

    // Escopado ao dia — a mesma equipe/categoria pode (e deve, num
    // evento de vários dias) se apresentar uma vez em cada dia; só
    // duas vezes no MESMO dia é que não faz sentido.
    const alreadyScheduled = await this.entriesRepo
      .createQueryBuilder('entry')
      .innerJoin('entry.resource', 'resource')
      .where('resource.scheduleDayId = :dayId', { dayId })
      .andWhere('entry.type = :type', { type: ScheduleEntryType.PRESENTATION })
      .andWhere('entry.teamId = :teamId', { teamId })
      .andWhere('entry.categoryId = :categoryId', { categoryId })
      .getCount();
    if (alreadyScheduled > 0) {
      throw new ConflictException(
        'Essa apresentação já está agendada neste dia.',
      );
    }

    return { team, category };
  }

  // O pareamento fica no aquecimento (ScheduleResource.pairedResourceId
  // aponta pra pista que ele atende) — não o contrário — porque é comum
  // uma pista ter mais de um aquecimento vinculado (evento grande, mais
  // de uma área de aquecimento por pista). Entre os candidatos, escolhe
  // o que tem o próximo horário livre mais cedo (menor soma de duração
  // das entries já existentes) — "a linha de tempo com espaço
  // disponível mais próximo".
  private async getAvailableWarmupResourceForMat(
    day: ScheduleDay,
    matResource: ScheduleResource,
  ): Promise<ScheduleResource> {
    const candidates = await this.resourcesRepo.find({
      where: { scheduleDayId: day.id, pairedResourceId: matResource.id },
      order: { order: 'ASC' },
    });
    if (candidates.length === 0) {
      throw new ConflictException(
        `Nenhuma área de aquecimento está vinculada a "${matResource.name}" — vincule uma em "Editar recurso" na área de aquecimento.`,
      );
    }
    if (candidates.length === 1) return candidates[0];

    let best = candidates[0];
    let bestElapsed = await this.getResourceElapsedMinutes(best.id);
    for (const candidate of candidates.slice(1)) {
      const elapsed = await this.getResourceElapsedMinutes(candidate.id);
      if (elapsed < bestElapsed) {
        best = candidate;
        bestElapsed = elapsed;
      }
    }
    return best;
  }

  private async getResourceElapsedMinutes(resourceId: string): Promise<number> {
    const entries = await this.entriesRepo.find({ where: { resourceId } });
    return entries.reduce((sum, e) => sum + e.durationMinutes, 0);
  }

  // Insere uma entry na posição `orderHint` do recurso, renumerando os
  // irmãos em sequência (0..n-1) — usado tanto por criação isolada
  // quanto pela geração automática.
  private async insertIntoResource(
    resourceId: string,
    orderHint: number,
    data: Partial<ScheduleEntry>,
  ): Promise<ScheduleEntry> {
    const siblings = await this.entriesRepo.find({
      where: { resourceId },
      order: { order: 'ASC' },
    });
    const insertAt = Math.max(0, Math.min(orderHint, siblings.length));
    const entry = this.entriesRepo.create({
      ...data,
      resourceId,
      order: insertAt,
    });
    siblings.splice(insertAt, 0, entry);
    siblings.forEach((e, idx) => {
      e.order = idx;
    });
    await this.entriesRepo.save(siblings);
    return entry;
  }

  private async renumberResource(resourceId: string): Promise<void> {
    const entries = await this.entriesRepo.find({
      where: { resourceId },
      order: { order: 'ASC' },
    });
    entries.forEach((e, idx) => {
      e.order = idx;
    });
    if (entries.length > 0) {
      await this.entriesRepo.save(entries);
    }
  }

  private presentationDurationMinutes(category: Category): number {
    return Math.max(
      1,
      Math.round((category.presentationTimeSeconds ?? 60) / 60),
    );
  }

  private async seedDays(event: Event): Promise<ScheduleDay[]> {
    const days: ScheduleDay[] = [];
    for (let i = 1; i <= event.competitionDays; i++) {
      days.push(await this.createDay(event, i));
    }
    return days;
  }

  private async createDay(
    event: Event,
    dayIndex: number,
  ): Promise<ScheduleDay> {
    const date = addDaysToDateString(event.startDate, dayIndex - 1);
    const day = this.daysRepo.create({
      aliasId: event.aliasId,
      dayIndex,
      date,
      startMinutes: 480,
      endMinutes: 1200,
      defaultWarmupMinutes: 10,
    });
    const saved = await this.daysRepo.save(day);
    await this.seedDefaultResources(saved);
    return saved;
  }

  // Ponto de partida razoável (1 pista + seu aquecimento pareado) pra
  // não abrir o dia vazio — daqui em diante o organizador adiciona,
  // renomeia e reordena livremente via CRUD de recursos.
  //
  // O pareamento fica no aquecimento apontando pra pista (não o
  // contrário) — é o lado "muitos" da relação: uma pista pode ter
  // vários aquecimentos vinculados (comum em eventos grandes), mas
  // cada aquecimento só atende uma pista por vez.
  private async seedDefaultResources(day: ScheduleDay): Promise<void> {
    const mat = await this.resourcesRepo.save(
      this.resourcesRepo.create({
        scheduleDayId: day.id,
        name: 'Pista 1',
        supportsPresentations: true,
        order: 0,
      }),
    );
    await this.resourcesRepo.save(
      this.resourcesRepo.create({
        scheduleDayId: day.id,
        name: 'Aquecimento 1',
        supportsPresentations: false,
        pairedResourceId: mat.id,
        order: 1,
      }),
    );
  }

  private async hydrateDays(days: ScheduleDay[]): Promise<ScheduleDayView[]> {
    if (days.length === 0) return [];
    const dayIds = days.map((d) => d.id);
    const resources = await this.resourcesRepo.find({
      where: { scheduleDayId: In(dayIds) },
      order: { order: 'ASC' },
    });
    const resourceIds = resources.map((r) => r.id);
    const entries = resourceIds.length
      ? await this.entriesRepo.find({
          where: { resourceId: In(resourceIds) },
          order: { order: 'ASC' },
        })
      : [];
    const entryViews = await this.attachNames(entries);

    return days.map((day) => ({
      ...day,
      resources: resources
        .filter((r) => r.scheduleDayId === day.id)
        .map((r) => ({
          ...r,
          entries: entryViews.filter((e) => e.resourceId === r.id),
        })),
    }));
  }

  private async attachNames(
    entries: ScheduleEntry[],
  ): Promise<ScheduleEntryView[]> {
    const teamIds = [
      ...new Set(entries.map((e) => e.teamId).filter((v): v is string => !!v)),
    ];
    const categoryIds = [
      ...new Set(
        entries.map((e) => e.categoryId).filter((v): v is string => !!v),
      ),
    ];
    const teams = teamIds.length
      ? await this.teamsRepo.find({ where: { id: In(teamIds) } })
      : [];
    const categories = categoryIds.length
      ? await this.categoriesRepo.find({ where: { id: In(categoryIds) } })
      : [];
    const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

    return entries.map((e) => ({
      ...e,
      teamName: e.teamId ? (teamNameById.get(e.teamId) ?? null) : null,
      categoryName: e.categoryId
        ? (categoryNameById.get(e.categoryId) ?? null)
        : null,
    }));
  }

  // Público — usado por JudgingService pra validar que um dayId de
  // função especial (ver SpecialRoleAssignment) pertence de fato ao
  // evento antes de gravar a atribuição.
  async findDayOrThrow(eventId: string, dayId: string): Promise<ScheduleDay> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const day = await this.daysRepo.findOneBy({
      id: dayId,
      aliasId: event.aliasId,
    });
    if (!day) throw new NotFoundException('Dia do cronograma não encontrado');
    return day;
  }

  private async findResourceOrThrow(
    dayId: string,
    resourceId: string,
  ): Promise<ScheduleResource> {
    const resource = await this.resourcesRepo.findOneBy({
      id: resourceId,
      scheduleDayId: dayId,
    });
    if (!resource) throw new NotFoundException('Recurso não encontrado');
    return resource;
  }

  // Público — usado por JudgingService pra validar um resourceId de
  // função especial (ver SpecialRoleAssignment) sem já saber de qual
  // dia ele é (diferente de findResourceOrThrow, que exige o dayId de
  // antemão).
  async findResourceInEventOrThrow(
    eventId: string,
    resourceId: string,
  ): Promise<ScheduleResource> {
    const resource = await this.resourcesRepo.findOneBy({ id: resourceId });
    if (!resource) throw new NotFoundException('Recurso não encontrado');
    await this.findDayOrThrow(eventId, resource.scheduleDayId);
    return resource;
  }

  // Busca a entry SEM popular a relação `resource` de propósito — se
  // ela viesse hidratada e depois mudássemos só a coluna crua
  // `entry.resourceId` (ver moveEntry), o TypeORM monta o UPDATE a
  // partir da relação (ainda apontando pro recurso antigo) e ignora a
  // coluna que mudamos manualmente, fazendo o "mover pra outro
  // recurso" silenciosamente não mover nada. Valida o dia via uma
  // consulta separada em vez de carregar o objeto relacionado.
  private async findEntryInDayOrThrow(
    dayId: string,
    entryId: string,
  ): Promise<ScheduleEntry> {
    const entry = await this.entriesRepo.findOneBy({ id: entryId });
    if (!entry)
      throw new NotFoundException('Item do cronograma não encontrado');
    const resource = await this.resourcesRepo.findOneBy({
      id: entry.resourceId,
      scheduleDayId: dayId,
    });
    if (!resource)
      throw new NotFoundException('Item do cronograma não encontrado');
    return entry;
  }
}

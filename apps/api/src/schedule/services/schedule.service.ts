import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { ScheduleDay } from '../entities/schedule-day.entity';
import { ScheduleResource } from '../entities/schedule-resource.entity';
import { ScheduleEntry } from '../entities/schedule-entry.entity';
import { ScheduleEntryType } from '../enums/schedule-entry-type.enum';
import { ScheduleAutoSettings } from '../entities/schedule-auto-settings.entity';
import { ScoreEvent } from '../../scoring/entities/score-event.entity';
import {
  findSpecialEventsProblem,
  planSpecialEvents,
  type SpecialEvent,
} from '../special-events';
import { UpdateAutoGenerateSettingsDto } from '../dto/update-auto-generate-settings.dto';
import {
  AutoGenerateLevelDirection,
  AutoGenerateOrderPrimary,
  autoFormatKey,
  DEFAULT_AUTO_FORMAT_ORDER,
} from '../enums/auto-generate-order.enum';
import { UpdateScheduleDayDto } from '../dto/update-schedule-day.dto';
import { CreateScheduleResourceDto } from '../dto/create-schedule-resource.dto';
import { UpdateScheduleResourceDto } from '../dto/update-schedule-resource.dto';
import { MoveScheduleResourceDto } from '../dto/move-schedule-resource.dto';
import { CreateScheduleEntryDto } from '../dto/create-schedule-entry.dto';
import { MoveScheduleEntryDto } from '../dto/move-schedule-entry.dto';
import { UpdateScheduleEntryDto } from '../dto/update-schedule-entry.dto';
import { AutoGenerateScheduleDto } from '../dto/auto-generate-schedule.dto';
import { Team } from '../../teams/entities/team.entity';
import { Category } from '../../categories/entities/category.entity';
import { CategoryFormat } from '../../categories/enums/category-format.enum';
import { Event } from '../../events/entities/event.entity';
import { EventsService } from '../../events/services/events.service';
import { EventActivityLogService } from '../../events/services/event-activity-log.service';
import { EventActivityAction } from '../../events/enums/event-activity-action.enum';
import { EventStatus } from '../../events/enums/event-status.enum';
import { stripUndefined } from '../../common/utils/strip-undefined';
import { addDaysToDateString } from '../../common/utils/add-days-to-date-string';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/enums/notification-type.enum';
import { NotificationAudience } from '../../notifications/enums/notification-audience.enum';

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

export interface AutoGenerateSettingsView {
  orderPrimary: AutoGenerateOrderPrimary;
  levelDirection: AutoGenerateLevelDirection;
  formatOrder: string[];
  specialEvents: SpecialEvent[];
}

export interface UnscheduledPairView {
  teamId: string;
  teamName: string;
  categoryId: string;
  categoryName: string;
  categoryFormat: CategoryFormat;
  customFormatLabel: string | null;
  level: number;
  durationMinutes: number;
  warmupMinutes: number;
}

const DEFAULT_COMPONENT_DURATION_MINUTES = 15;

// Rótulo fixo do break "intervalo entre apresentações" (ver
// createPresentationWithWarmup/autoGenerate) — é o que diferencia esse
// break, no `removeEntry`, dos breaks "Aguardando..." (que também têm
// `linkedEntryId` mas não podem ser removidos direto, só via a
// apresentação). Ao contrário deles, este É removível direto pelo
// usuário (a apresentação não some junto) — só o inverso (excluir a
// apresentação também exclui o intervalo) é automático.
const INTERVAL_BREAK_LABEL = 'Intervalo entre apresentações';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(ScheduleDay)
    private readonly daysRepo: Repository<ScheduleDay>,
    @InjectRepository(ScheduleResource)
    private readonly resourcesRepo: Repository<ScheduleResource>,
    @InjectRepository(ScheduleEntry)
    private readonly entriesRepo: Repository<ScheduleEntry>,
    @InjectRepository(ScheduleAutoSettings)
    private readonly autoSettingsRepo: Repository<ScheduleAutoSettings>,
    // Só pra checar se uma apresentação já tem nota (repo direto, sem
    // importar ScoringModule — evita ciclo entre os módulos).
    @InjectRepository(ScoreEvent)
    private readonly scoreEventsRepo: Repository<ScoreEvent>,
    @InjectRepository(Team)
    private readonly teamsRepo: Repository<Team>,
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    private readonly eventsService: EventsService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: EventActivityLogService,
  ) {}

  // Sem linha salva = padrão. Não cria a linha na leitura.
  private async getAutoSettingsByAlias(
    aliasId: string,
  ): Promise<AutoGenerateSettingsView> {
    const row = await this.autoSettingsRepo.findOneBy({ aliasId });
    return {
      orderPrimary: row?.orderPrimary ?? AutoGenerateOrderPrimary.FORMAT,
      levelDirection: row?.levelDirection ?? AutoGenerateLevelDirection.ASC,
      formatOrder: row?.formatOrder ?? [],
      specialEvents: row?.specialEvents ?? [],
    };
  }

  async getAutoSettings(eventId: string): Promise<AutoGenerateSettingsView> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    return this.getAutoSettingsByAlias(event.aliasId);
  }

  async updateAutoSettings(
    eventId: string,
    dto: UpdateAutoGenerateSettingsDto,
  ): Promise<AutoGenerateSettingsView> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const problem = findSpecialEventsProblem(dto.specialEvents);
    if (problem) throw new BadRequestException(problem);
    const row =
      (await this.autoSettingsRepo.findOneBy({ aliasId: event.aliasId })) ??
      this.autoSettingsRepo.create({ aliasId: event.aliasId });
    row.orderPrimary = dto.orderPrimary;
    row.levelDirection = dto.levelDirection;
    row.formatOrder = dto.formatOrder;
    row.specialEvents = dto.specialEvents;
    await this.autoSettingsRepo.save(row);
    return this.getAutoSettingsByAlias(event.aliasId);
  }

  async getDays(eventId: string): Promise<ScheduleDayView[]> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    let days = await this.daysRepo.find({
      where: { aliasId: event.aliasId },
      order: { dayIndex: 'ASC' },
    });
    if (days.length === 0) {
      try {
        days = await this.seedDays(event);
      } catch (err) {
        // Corrida real, achada com teste de carga (packages/load-test,
        // 2026-09-24, 200 espectadores abrindo o evento ao mesmo
        // tempo): mais de uma requisição pode ver `days.length === 0`
        // antes de qualquer uma terminar de semear — a perdedora bate
        // na constraint única (alias_id, day_index) e virava 500. Se
        // foi exatamente essa corrida (outra requisição já semeou com
        // sucesso), só relê do banco em vez de propagar o erro.
        if (!(err instanceof QueryFailedError) || (err.driverError as { code?: string })?.code !== '23505') {
          throw err;
        }
        days = await this.daysRepo.find({
          where: { aliasId: event.aliasId },
          order: { dayIndex: 'ASC' },
        });
      }
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
    // O número no cabeçalho também deve redimensionar (ou remover) os
    // intervalos já agendados, não só valer pra apresentações futuras
    // (mesmo raciocínio já valia pro warmup antes dele virar campo por
    // categoria — ver Category.warmupMinutes).
    const gapMinutesChanged =
      dto.defaultGapMinutes !== undefined &&
      dto.defaultGapMinutes !== day.defaultGapMinutes;
    Object.assign(day, stripUndefined(dto));
    const saved = await this.daysRepo.save(day);

    if (gapMinutesChanged) {
      await this.applyGapDurationToScheduledEntries(
        dayId,
        saved.defaultGapMinutes,
      );
    }

    const [hydrated] = await this.hydrateDays([saved]);
    return hydrated;
  }

  // Redimensiona (ou remove, se o novo valor for 0) os intervalos
  // "Intervalo entre apresentações" já agendados neste dia. Diferente
  // do warmup (que SEMPRE existe pra toda apresentação), o intervalo é
  // condicional (só existe antes de apresentações que não são a
  // primeira da pista) — por isso este método só ajusta os que já
  // existem, não cria intervalo novo pra apresentações que foram
  // criadas quando o padrão ainda era 0. Depois de mudar a duração,
  // reconcilia aquecimento/espera dos dois lados (mesmo raciocínio de
  // applyWarmupDurationToScheduledEntries): empurrar uma apresentação
  // mais cedo/tarde pode tornar uma espera desnecessária ou criar a
  // necessidade de uma nova.
  private async applyGapDurationToScheduledEntries(
    dayId: string,
    gapMinutes: number,
  ): Promise<void> {
    const resources = await this.resourcesRepo.find({
      where: { scheduleDayId: dayId },
    });
    const resourceIds = resources.map((r) => r.id);
    if (resourceIds.length === 0) return;

    const gapBreaks = await this.entriesRepo.find({
      where: {
        resourceId: In(resourceIds),
        type: ScheduleEntryType.BREAK,
        label: INTERVAL_BREAK_LABEL,
      },
    });
    if (gapBreaks.length === 0) return;

    if (gapMinutes <= 0) {
      const affectedResourceIds = new Set(gapBreaks.map((e) => e.resourceId));
      await this.entriesRepo.remove(gapBreaks);
      for (const resourceId of affectedResourceIds) {
        await this.renumberResource(resourceId);
      }
    } else {
      for (const gap of gapBreaks) {
        gap.durationMinutes = gapMinutes;
      }
      await this.entriesRepo.save(gapBreaks);
    }

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

    // Recurso de aquecimento só existe em função da(s) pista(s) que ele
    // atende (pairedResourceId, ver getAvailableWarmupResourceForMat)
    // — excluí-lo sozinho não faz sentido de forma independente, mesmo
    // raciocínio já aplicado à entry de aquecimento em si (não pode ser
    // excluída direto, só junto da apresentação). Só sai excluindo pela
    // pista (ver bloco mais abaixo, que leva os recursos de aquecimento
    // pareados a ela junto) — pedido do usuário, 2026-08-16.
    if (!resource.supportsPresentations) {
      throw new BadRequestException(
        'Um recurso de aquecimento não pode ser excluído diretamente — exclua a pista vinculada a ele para excluí-lo junto.',
      );
    }

    // Apresentações agendadas neste recurso têm o aquecimento (e os
    // intervalos "Aguardando aquecimento"/"Aguardando disponibilidade
    // da equipe") vinculados por linkedEntryId, quase sempre num
    // recurso DIFERENTE (a fila de aquecimento pareada) — a FK de
    // linkedEntryId é `onDelete: SET NULL`, não CASCADE, então excluir
    // só o recurso (cascade cuida apenas das entries QUE VIVEM nele)
    // deixaria esses aquecimentos órfãos presos na fila pra sempre, sem
    // apresentação nenhuma. Excluir o recurso deve levar junto tudo que
    // só existe por causa das apresentações que estavam nele (pedido do
    // usuário, 2026-08-16).
    const presentations = await this.entriesRepo.find({
      where: { resourceId, type: ScheduleEntryType.PRESENTATION },
    });
    const affectedResourceIds = new Set<string>();
    for (const presentation of presentations) {
      const linkedEntries = await this.entriesRepo.find({
        where: { linkedEntryId: presentation.id },
      });
      for (const linked of linkedEntries) {
        affectedResourceIds.add(linked.resourceId);
        await this.entriesRepo.remove(linked);
      }
    }
    affectedResourceIds.delete(resourceId);

    // Recursos de aquecimento pareados a esta pista (pairedResourceId
    // aponta pra cá) só existem em função dela (ver guard acima) —
    // excluir a pista sem eles deixaria um recurso de aquecimento vazio
    // e sem dono, impossível de excluir depois (o guard bloqueia
    // exclusão direta de recurso de aquecimento).
    const pairedWarmupResources = await this.resourcesRepo.find({
      where: { scheduleDayId: dayId, pairedResourceId: resourceId },
    });
    for (const paired of pairedWarmupResources) {
      affectedResourceIds.delete(paired.id);
    }

    await this.resourcesRepo.remove(resource);
    if (pairedWarmupResources.length > 0) {
      await this.resourcesRepo.remove(pairedWarmupResources);
    }

    for (const otherResourceId of affectedResourceIds) {
      await this.renumberResource(otherResourceId);
    }
    // Remover aquecimentos do meio da fila de outro recurso libera
    // tempo pras apresentações seguintes dela — precisa reconciliar os
    // dois lados de novo pra encolher/remover esperas que ficaram
    // desnecessárias (mesmo raciocínio de removeEntry/moveEntry acima).
    await this.reconcileWarmupDelays(dayId);
    await this.reconcileMatGaps(dayId);
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
          categoryFormat: category.categoryFormat,
          customFormatLabel: category.customFormatLabel,
          level: category.level,
          durationMinutes: this.presentationDurationMinutes(category),
          warmupMinutes: category.warmupMinutes,
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
      // já agendado) pra mais tarde — as três reconciliações
      // (aquecimento, ordem entre categorias da mesma equipe, pista)
      // são interdependentes, rodam em conjunto até estabilizar (mesmo
      // raciocínio/mesmo bug de reconciliação incompleta corrigido em
      // movePresentationWithWarmup).
      for (let pass = 0; pass < 3; pass++) {
        await this.reconcileWarmupDelays(dayId);
        await this.reconcileTeamWarmupOrder(dayId, dto.teamId!);
        await this.reconcileMatGaps(dayId);
      }
      await this.reconcileWarmupDelays(dayId);
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

  // Mover ou remover uma apresentação a RECRIA com outro id (o
  // aquecimento e as esperas são recalculados em torno da nova posição),
  // e ScoreEvent guarda `scheduleEntryId` como coluna simples, sem FK —
  // com nota já lançada, a nota ficaria ligada a um id que não existe
  // mais e a súmula passaria a enxergar zero notas ("notas nunca podem
  // ser perdidas"). Por isso, depois que alguma nota existe, a
  // apresentação fica travada (mesmo critério da desistência).
  private async assertPresentationHasNoScores(entryId: string): Promise<void> {
    const scores = await this.scoreEventsRepo.countBy({
      scheduleEntryId: entryId,
    });
    if (scores > 0) {
      throw new ConflictException(
        'Esta apresentação já tem notas lançadas, então não pode mais ser movida nem removida.',
      );
    }
  }

  async moveEntry(
    eventId: string,
    dayId: string,
    entryId: string,
    dto: MoveScheduleEntryDto,
    userId: string,
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
      await this.assertPresentationHasNoScores(entry.id);
      const teamName = entry.teamId
        ? (await this.teamsRepo.findOneBy({ id: entry.teamId }))?.name
        : null;
      const view = await this.movePresentationWithWarmup(day, entry, dto);
      await this.notifyPresentationMoved(eventId, teamName, userId);
      return view;
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
    // Mesma causa/fix do bug de removeEntry (2026-08-16): reordenar
    // qualquer item (intervalo, componente, aquecimento) numa pista ou
    // num recurso de aquecimento desloca o horário natural da
    // apresentação vinculada — sem reconcileMatGaps o "Aguardando
    // aquecimento" existente não encolhe/expande pra cobrir a nova
    // folga, sobrepondo aquecimento e apresentação.
    await this.reconcileWarmupDelays(dayId);
    await this.reconcileMatGaps(dayId);
    const updated = await this.entriesRepo.findOneBy({ id: entryId });
    const [view] = await this.attachNames([updated!]);
    return view;
  }

  // Edita nome/duração de um evento especial já lançado (Almoço,
  // Premiação, intervalo personalizado etc.) sem precisar remover e
  // recriar. Igual ao guard de removeEntry: apresentação, aquecimento e
  // os intervalos "Aguardando..." gerados automaticamente não têm nome
  // próprio editável nem duração independente da reconciliação que os
  // criou — só "Intervalo entre apresentações" (que também tem
  // linkedEntryId, mas é removível/editável como qualquer break normal)
  // e os eventos especiais soltos ficam de fora do bloqueio.
  async updateEntry(
    eventId: string,
    dayId: string,
    entryId: string,
    dto: UpdateScheduleEntryDto,
  ): Promise<ScheduleEntryView> {
    await this.findDayOrThrow(eventId, dayId);
    const entry = await this.findEntryInDayOrThrow(dayId, entryId);

    if (
      entry.type === ScheduleEntryType.PRESENTATION ||
      entry.type === ScheduleEntryType.WARMUP
    ) {
      throw new BadRequestException(
        'Apresentação e aquecimento não podem ser editados diretamente — use "Mover" para ajustar pista/posição.',
      );
    }
    if (entry.linkedEntryId && entry.label !== INTERVAL_BREAK_LABEL) {
      throw new BadRequestException(
        'Este intervalo é gerado automaticamente para evitar conflito de agenda da equipe e não pode ser editado diretamente.',
      );
    }

    Object.assign(entry, stripUndefined(dto));
    await this.entriesRepo.save(entry);

    // Duração mudando desloca o que vem depois na mesma fila/pista —
    // mesmo raciocínio de createEntry/moveEntry/removeEntry acima.
    await this.reconcileWarmupDelays(dayId);
    await this.reconcileMatGaps(dayId);

    const updated = await this.entriesRepo.findOneBy({ id: entryId });
    const [view] = await this.attachNames([updated!]);
    return view;
  }

  // Notifica (audiência ALL, pedido do usuário: "quem vê? todos") e
  // registra no histórico do evento quando uma apresentação é movida —
  // 2026-07-27. Só a partir de "published" em diante: mover apresentação
  // enquanto o evento ainda está "created" é só ajuste de construção do
  // cronograma (sem plateia/participantes acompanhando ainda), sem valor
  // de notificar ninguém — mesma exceção documentada em
  // EventActivityAction.PRESENTATION_MOVED.
  private async notifyPresentationMoved(
    eventId: string,
    teamName: string | null | undefined,
    userId: string,
  ): Promise<void> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    if (event.status === EventStatus.CREATED) return;
    await this.notificationsService.create(
      event.aliasId,
      NotificationType.PRESENTATION_MOVED,
      NotificationAudience.ALL,
      `${teamName ?? 'Equipe'} teve a apresentação remanejada no cronograma`,
    );
    await this.activityLogService.record(
      event.aliasId,
      userId,
      EventActivityAction.PRESENTATION_MOVED,
      teamName ?? undefined,
    );
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
    // Checagem adiantada, ANTES de remover a apresentação original —
    // pego em 2026-07-27 testando a feature de mover apresentação na
    // tela ao vivo: sem isso, mover pra um recurso sem aquecimento
    // vinculado removia a apresentação (e o aquecimento antigo) e só
    // DEPOIS falhava dentro de createPresentationWithWarmup (mesma
    // checagem, mas tarde demais) — sem transação cobrindo o método
    // inteiro, a remoção não era desfeita, apagando a apresentação de
    // verdade sem recriar em lugar nenhum. Repetir aqui a mesma
    // validação de getAvailableWarmupResourceForMat evita esse caminho
    // destrutivo continuar acessível (builder de setup, drag-and-drop,
    // usa o mesmo endpoint e sofria do mesmo risco).
    await this.getAvailableWarmupResourceForMat(day, targetResource);

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

    // Corrige a ordem dos aquecimentos da MESMA equipe entre si, o
    // atraso de disponibilidade (lado do aquecimento) e o "Aguardando
    // aquecimento" (lado da pista) — as três reconciliações são
    // interdependentes (mudar uma pode tornar a outra desatualizada),
    // por isso rodam em conjunto, repetidas até estabilizar. **Bug real
    // pego em 2026-07-27, testando a feature de mover apresentação**:
    // rodando cada uma só uma vez, numa ordem fixa terminando em
    // reconcileMatGaps, sobrava uma "Aguardando disponibilidade da
    // equipe" desnecessária no início do dia — a folga que
    // reconcileMatGaps cria do lado da pista (última a rodar) podia
    // tornar aquele atraso obsoleto sem nunca ser limpo, porque
    // reconcileWarmupDelays não rodava de novo depois. A passada final
    // isolada cobre esse caso.
    for (let pass = 0; pass < 3; pass++) {
      await this.reconcileWarmupDelays(day.id);
      await this.reconcileTeamWarmupOrder(day.id, teamId);
      await this.reconcileMatGaps(day.id);
    }
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
    if (entry.type === ScheduleEntryType.PRESENTATION) {
      await this.assertPresentationHasNoScores(entry.id);
    }

    // Aquecimento e intervalos "Aguardando aquecimento"/"Aguardando
    // disponibilidade da equipe" são todos gerados automaticamente
    // junto com a apresentação (ver createPresentationWithWarmup/
    // autoGenerate) — nenhum dos dois pode ser excluído sozinho:
    // excluir só o aquecimento deixaria a apresentação sem aquecimento
    // vinculado (createPresentationWithWarmup/movePresentationWithWarmup
    // assumem que toda apresentação tem um); excluir só uma das esperas
    // reabre o conflito de agenda que ela existia pra evitar. Diferente
    // do removeEntry "normal", não tem como a reconciliação recriar
    // uma espera que falta (só ajusta/remove as que já existem) —
    // ficaria sem jeito de consertar pela UI. Só sai removendo a
    // apresentação correspondente (que aí sim limpa o grupo inteiro,
    // ver abaixo).
    //
    // "Intervalo entre apresentações" é diferente: não existe pra
    // evitar um conflito de agenda, é só um espaçamento fixo que o
    // organizador pediu — pode ser removido direto (a apresentação
    // continua existindo), só o inverso (excluir a apresentação também
    // exclui o intervalo, ver bloco abaixo) é automático.
    if (entry.type === ScheduleEntryType.WARMUP) {
      throw new BadRequestException(
        'O aquecimento não pode ser excluído diretamente — remova a apresentação correspondente para excluí-lo junto.',
      );
    }
    if (
      entry.type === ScheduleEntryType.BREAK &&
      entry.linkedEntryId &&
      entry.label !== INTERVAL_BREAK_LABEL
    ) {
      throw new BadRequestException(
        'Este intervalo é gerado automaticamente para evitar conflito de agenda da equipe — remova a apresentação correspondente para removê-lo.',
      );
    }

    // A apresentação é o "centro" do grupo — aquecimento e os
    // intervalos de espera criados pra encaixar os dois (ver
    // createPresentationWithWarmup/autoGenerate) todos apontam
    // linkedEntryId pra ela. Resolver pro id da apresentação permite
    // limpar o grupo inteiro (aquecimento + "Aguardando aquecimento" +
    // "Aguardando disponibilidade da equipe") em uma consulta só —
    // excluir a apresentação sem eles deixaria buracos órfãos na
    // timeline que dessincronizam o horário do resto do dia.
    const presentationId =
      entry.type === ScheduleEntryType.PRESENTATION ? entry.id : null;

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
    // Remover o "Intervalo entre apresentações" muda o horário natural
    // de início da apresentação seguinte na mesma pista — sem isso, um
    // "Aguardando aquecimento" já existente não encolhe/expande pra
    // cobrir a nova folga, deixando aquecimento e apresentação
    // sobrepostos (conflito real, reportado pelo usuário 2026-08-16).
    await this.reconcileMatGaps(dayId);
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

    // Ordena por formato (Team Cheer > Group Stunt > Coed/Elite Stunt >
    // Partner Stunt > demais) e, dentro do mesmo formato, por nível
    // crescente — antes de distribuir nos buckets abaixo, então as
    // duas estratégias de distribuição (SEQUENTIAL e round-robin)
    // herdam a preferência automaticamente.
    // Ordem configurada por evento (engrenagem ao lado de "Gerar
    // automaticamente"): o critério primário manda, o outro só
    // desempata dentro de cada grupo dele. Nível pode ser crescente ou
    // decrescente; formato segue a lista de preferência do usuário.
    const settings = await this.getAutoSettingsByAlias(day.aliasId);
    const order = settings.formatOrder;
    const rankOf = (pair: UnscheduledPairView) => {
      let index = order.indexOf(
        autoFormatKey(pair.categoryFormat, pair.customFormatLabel),
      );
      // Custom sem rótulo salvo na lista cai no "custom" genérico (se
      // houver) e, por fim, no fim da fila na ordem padrão.
      if (index === -1) index = order.indexOf(pair.categoryFormat);
      if (index === -1) {
        index =
          order.length + DEFAULT_AUTO_FORMAT_ORDER.indexOf(pair.categoryFormat);
      }
      return index;
    };
    const levelSign =
      settings.levelDirection === AutoGenerateLevelDirection.DESC ? -1 : 1;
    const byFormat = (a: UnscheduledPairView, b: UnscheduledPairView) =>
      rankOf(a) - rankOf(b);
    const byLevel = (a: UnscheduledPairView, b: UnscheduledPairView) =>
      levelSign * (a.level - b.level);
    const levelFirst = settings.orderPrimary === AutoGenerateOrderPrimary.LEVEL;
    const unscheduled = [...(await this.getUnscheduled(eventId, day.id))].sort(
      (a, b) =>
        levelFirst
          ? byLevel(a, b) || byFormat(a, b)
          : byFormat(a, b) || byLevel(a, b),
    );
    const specialProblem = findSpecialEventsProblem(settings.specialEvents);
    if (specialProblem) throw new BadRequestException(specialProblem);
    const specialPlan = planSpecialEvents(settings.specialEvents);
    // Entry criada em cada pista por evento especial (id do evento ->
    // ids das entries), pra sincronizar o fim depois.
    const specialEntryIds = new Map<string, string[]>();

    // Cada pista vira um "runner" com o próprio andamento. As apresentações
    // (já na ordem definida pelo usuário) são então encaixadas uma a uma
    // na pista onde conseguem começar mais cedo — isso otimiza o uso das
    // pistas (fim do dia parecido nas duas) sem perder a ordem de
    // categoria e nível.
    interface MatRunner {
      estimateStart: (pair: UnscheduledPairView) => Promise<number>;
      place: (pair: UnscheduledPairView) => Promise<void>;
      finish: () => Promise<void>;
    }
    const runners: MatRunner[] = [];

    for (const mat of mats) {
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
      // Mesma regra de createPresentationWithWarmup: só a primeira
      // apresentação desta pista fica sem o intervalo — resetado a
      // cada pista, já que cada uma tem sua própria fila.
      let matHasPresentation = false;

      // Insere um evento especial (Almoço, Abertura...) na fila desta
      // pista e — quando `alignWarmups` — também nas áreas de
      // aquecimento dela (assim o aquecimento não segue rodando durante
      // o evento). A duração aqui é a MÍNIMA pedida pelo usuário: o fim
      // comum a todas as pistas é ajustado depois de todas geradas (ver
      // syncSpecialEventEnds). Arrow function pra manter o `this`.
      const insertSpecial = async (
        event: SpecialEvent,
        alignWarmups: boolean,
      ): Promise<void> => {
        const created = await this.insertIntoResource(mat.id, matOrder++, {
          type: event.type,
          durationMinutes: event.durationMinutes,
          label: event.label,
        });
        const ids = specialEntryIds.get(event.id) ?? [];
        ids.push(created.id);
        specialEntryIds.set(event.id, ids);
        matElapsed += event.durationMinutes;
        if (alignWarmups) {
          for (const warmupResource of warmupCandidates) {
            await this.insertIntoResource(
              warmupResource.id,
              Number.MAX_SAFE_INTEGER,
              {
                type: event.type,
                durationMinutes: event.durationMinutes,
                label: event.label,
              },
            );
            warmupElapsedByResource.set(
              warmupResource.id,
              (warmupElapsedByResource.get(warmupResource.id) ?? 0) +
                event.durationMinutes,
            );
          }
        }
        // Depois de um evento especial a próxima apresentação não
        // deveria também levar o "Intervalo entre apresentações" — o
        // evento já é, ele mesmo, um intervalo bem maior logo antes
        // dela (bug real 2026-08-05: o gap redundante colava depois do
        // almoço).
        matHasPresentation = false;
      };
      const insertCluster = async (
        items: SpecialEvent[],
        alignWarmups: boolean,
      ): Promise<void> => {
        for (const item of items) await insertSpecial(item, alignWarmups);
      };

      // Horários fixos ainda não atingidos nesta pista (cada pista tem o
      // seu próprio andamento).
      const pendingTime = [...specialPlan.time];
      for (const cluster of specialPlan.start) {
        await insertCluster(cluster.items, true);
      }

      const place = async (pair: UnscheduledPairView): Promise<void> => {
        // Olha pra FRENTE, não só pra trás: comparar só o `matElapsed`
        // de quando a apresentação ANTERIOR terminou contra o horário
        // fixo do evento deixava passar uma apresentação inteira sempre
        // que ela começasse um pouco antes do horário, mesmo terminando
        // bem depois dele (bug real 2026-08-05: almoço configurado pra
        // 08:35, apresentação anterior tinha terminado 08:33, e em vez
        // do almoço entrar ali a próxima apresentação era encaixada na
        // frente). Projeta o intervalo + duração desta apresentação
        // (antes de criar qualquer coisa) e insere o evento primeiro se
        // isso ultrapassar o horário. Reavalia a cada evento inserido
        // (o andamento da pista mudou).
        const prospectiveEnd = (): number =>
          day.startMinutes +
          matElapsed +
          (matHasPresentation ? day.defaultGapMinutes : 0) +
          pair.durationMinutes;
        while (
          pendingTime.length > 0 &&
          prospectiveEnd() > (pendingTime[0].timeMinutes ?? 0)
        ) {
          const due = pendingTime.shift()!;
          await insertCluster(due.items, true);
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
          pair.warmupMinutes,
          teamBusyWindows,
        );
        const warmupDelayMinutes = resolvedWarmupStart - naturalWarmupStart;
        if (warmupDelayMinutes > 0) {
          chosenElapsed += warmupDelayMinutes;
          warmupElapsedByResource.set(chosenWarmupId, chosenElapsed);
        }

        // Mesmo raciocínio de createPresentationWithWarmup: o intervalo
        // conta como tempo já decorrido nesta pista ANTES de avaliar se
        // ainda falta esperar o aquecimento terminar — senão o
        // "Aguardando aquecimento" calculado abaixo ignoraria o
        // intervalo que vai entrar na frente dele.
        const gapMinutes = matHasPresentation ? day.defaultGapMinutes : 0;
        if (gapMinutes > 0) matElapsed += gapMinutes;

        const warmupEndAfterThisPair = chosenElapsed + pair.warmupMinutes;
        const needsMatGap = warmupEndAfterThisPair > matElapsed;
        const matGapMinutes = needsMatGap
          ? warmupEndAfterThisPair - matElapsed
          : 0;
        if (needsMatGap) matElapsed += matGapMinutes;

        // Cria a apresentação primeiro (posição provisória — os
        // intervalos abaixo entram na mesma posição (`presentationSlot`)
        // logo em seguida, sempre empurrando-a um lugar mais adiante)
        // pra poder vincular os intervalos a ela via linkedEntryId,
        // mesma técnica de createPresentationWithWarmup — sem isso,
        // removeEntry não consegue limpar os intervalos junto quando a
        // apresentação é removida (ver gotcha de dessincronia de
        // horário). Reinserir sempre no mesmo `presentationSlot` (em
        // vez de usar `matOrder` incrementando a cada passo) garante a
        // ordem final [intervalo] [Aguardando aquecimento, se houver]
        // [apresentação] — o último a entrar fica mais perto do início.
        const presentationSlot = matOrder;
        const presentation = await this.insertIntoResource(
          mat.id,
          presentationSlot,
          {
            type: ScheduleEntryType.PRESENTATION,
            durationMinutes: pair.durationMinutes,
            teamId: pair.teamId,
            categoryId: pair.categoryId,
          },
        );

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
          await this.insertIntoResource(mat.id, presentationSlot, {
            type: ScheduleEntryType.BREAK,
            durationMinutes: matGapMinutes,
            label: 'Aguardando aquecimento',
            linkedEntryId: presentation.id,
          });
        }

        if (gapMinutes > 0) {
          await this.insertIntoResource(mat.id, presentationSlot, {
            type: ScheduleEntryType.BREAK,
            durationMinutes: gapMinutes,
            label: INTERVAL_BREAK_LABEL,
            linkedEntryId: presentation.id,
          });
        }

        matOrder =
          presentationSlot +
          1 +
          (needsMatGap ? 1 : 0) +
          (gapMinutes > 0 ? 1 : 0);
        matHasPresentation = true;

        await this.insertIntoResource(chosenWarmupId, Number.MAX_SAFE_INTEGER, {
          type: ScheduleEntryType.WARMUP,
          durationMinutes: pair.warmupMinutes,
          teamId: pair.teamId,
          categoryId: pair.categoryId,
          linkedEntryId: presentation.id,
        });

        matElapsed += pair.durationMinutes;
        warmupElapsedByResource.set(
          chosenWarmupId,
          chosenElapsed + pair.warmupMinutes,
        );
      };

      // Quando (minuto do dia) a apresentação começaria nesta pista, sem
      // gravar nada. Mesma conta de `place`: eventos de horário fixo que
      // entrariam antes, intervalo entre apresentações, e o maior entre
      // "a pista ficar livre" e "o aquecimento terminar" (área de
      // aquecimento mais livre + equipe já ocupada em outro lugar).
      const estimateStart = async (
        pair: UnscheduledPairView,
      ): Promise<number> => {
        let elapsed = matElapsed;
        let hasPresentation = matHasPresentation;
        const warmupElapsed = new Map(warmupElapsedByResource);
        for (const cluster of pendingTime) {
          const prospectiveEnd =
            day.startMinutes +
            elapsed +
            (hasPresentation ? day.defaultGapMinutes : 0) +
            pair.durationMinutes;
          if (prospectiveEnd <= (cluster.timeMinutes ?? 0)) break;
          const total = cluster.items.reduce(
            (sum, e) => sum + e.durationMinutes,
            0,
          );
          elapsed += total;
          for (const [id, value] of warmupElapsed) {
            warmupElapsed.set(id, value + total);
          }
          hasPresentation = false;
        }
        const gap = hasPresentation ? day.defaultGapMinutes : 0;
        const teamBusyWindows = await this.getTeamBusyWindows(day, pair.teamId);
        const warmupStart = this.resolveNonOverlappingStart(
          day.startMinutes + Math.min(...warmupElapsed.values()),
          pair.warmupMinutes,
          teamBusyWindows,
        );
        return Math.max(
          day.startMinutes + elapsed + gap,
          warmupStart + pair.warmupMinutes,
        );
      };

      // Horários fixos que a pista nunca alcançou (poucas apresentações)
      // entram logo depois da última apresentação — não sobrou nada
      // depois pra ancorar um horário melhor — seguidos dos eventos "ao
      // final das apresentações". Sem alinhar o aquecimento: não há mais
      // apresentação nenhuma pra aquecer depois.
      const finish = async (): Promise<void> => {
        for (const cluster of pendingTime) {
          await insertCluster(cluster.items, false);
        }
        for (const cluster of specialPlan.end) {
          await insertCluster(cluster.items, false);
        }
      };

      runners.push({ estimateStart, place, finish });
    }

    // Empate (ex: todas as pistas livres no começo) fica com a primeira
    // pista, o que naturalmente alterna entre elas conforme cada uma
    // vai ocupando.
    for (const pair of unscheduled) {
      let best = runners[0];
      let bestStart = Infinity;
      for (const runner of runners) {
        const start = await runner.estimateStart(pair);
        if (start < bestStart) {
          best = runner;
          bestStart = start;
        }
      }
      await best.place(pair);
    }
    for (const runner of runners) await runner.finish();

    await this.syncSpecialEventEnds(day.id, specialEntryIds);

    const [hydrated] = await this.hydrateDays([day]);
    return hydrated;
  }

  // Todo evento especial termina no MESMO horário em todas as pistas
  // (pedido do usuário): cada pista o começa quando chega nele, então o
  // fim comum é o maior fim entre as pistas, e nas outras o evento é
  // estendido até lá (a duração informada é só o mínimo). Estender
  // empurra o que vem depois na pista e pode desalinhar o aquecimento,
  // então reconcilia em seguida. Processa em ordem cronológica (menor
  // fim primeiro): sincronizar um evento só empurra o que vem depois,
  // nunca o que já foi sincronizado antes dele. A área de aquecimento
  // fica como está (mantém o aquecimento correndo em paralelo), o fim
  // comum vale só pras pistas.
  private async syncSpecialEventEnds(
    dayId: string,
    specialEntryIds: Map<string, string[]>,
  ): Promise<void> {
    const multiMat = [...specialEntryIds.entries()].filter(
      ([, ids]) => ids.length > 1,
    );
    if (multiMat.length === 0) return;

    const day = await this.daysRepo.findOneByOrFail({ id: dayId });
    const mats = await this.resourcesRepo.find({
      where: { scheduleDayId: dayId, supportsPresentations: true },
    });
    const pending = new Set(multiMat.map(([eventId]) => eventId));

    while (pending.size > 0) {
      const entries = await this.entriesRepo.find({
        where: { resourceId: In(mats.map((m) => m.id)) },
        order: { order: 'ASC' },
      });
      const endById = new Map<string, number>();
      const byResource = new Map<string, ScheduleEntry[]>();
      for (const entry of entries) {
        const list = byResource.get(entry.resourceId) ?? [];
        list.push(entry);
        byResource.set(entry.resourceId, list);
      }
      for (const list of byResource.values()) {
        let cursor = day.startMinutes;
        for (const entry of list) {
          cursor += entry.durationMinutes;
          endById.set(entry.id, cursor);
        }
      }

      let nextEventId: string | null = null;
      let nextEnd = Infinity;
      for (const eventId of pending) {
        const ids = specialEntryIds.get(eventId) ?? [];
        const commonEnd = Math.max(...ids.map((id) => endById.get(id) ?? 0));
        if (commonEnd < nextEnd) {
          nextEnd = commonEnd;
          nextEventId = eventId;
        }
      }
      if (nextEventId === null) return;

      for (const id of specialEntryIds.get(nextEventId) ?? []) {
        const end = endById.get(id) ?? nextEnd;
        if (end >= nextEnd) continue;
        const entry = entries.find((e) => e.id === id);
        if (!entry) continue;
        entry.durationMinutes += nextEnd - end;
        await this.entriesRepo.save(entry);
      }
      pending.delete(nextEventId);
      await this.reconcileWarmupDelays(dayId);
      await this.reconcileMatGaps(dayId);
    }
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
      targetDay.defaultGapMinutes = sourceDay.defaultGapMinutes;
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
    const warmupDurationMinutes = category.warmupMinutes;

    const matSiblings = await this.entriesRepo.find({
      where: { resourceId: resource.id },
      order: { order: 'ASC' },
    });
    // Se a posição pedida cai no meio do "grupo" de uma apresentação
    // (entre a espera/intervalo dela e ela mesma), cola na frente do
    // grupo: as esperas pertencem à apresentação seguinte e são
    // recalculadas em função dela, então separar os dois deixava a
    // espera órfã na frente da apresentação errada.
    const insertAt = this.snapToPresentationGroupStart(
      matSiblings,
      Math.max(0, Math.min(dto.order, matSiblings.length)),
    );
    const laterPresentationIds = new Set(
      matSiblings
        .slice(insertAt)
        .filter((e) => e.type === ScheduleEntryType.PRESENTATION)
        .map((e) => e.id),
    );

    const warmupResource = await this.getAvailableWarmupResourceForMat(
      day,
      resource,
      laterPresentationIds,
    );
    const warmupSiblings = await this.entriesRepo.find({
      where: { resourceId: warmupResource.id },
      order: { order: 'ASC' },
    });
    // O aquecimento entra na fila na MESMA ordem relativa da
    // apresentação na pista: logo antes do aquecimento da primeira
    // apresentação que vem depois dela (com a espera de disponibilidade
    // dela, se houver, ficando junto do aquecimento dela) — ou no fim
    // da fila quando não há nenhuma depois. Sempre no fim (como era)
    // mandava o aquecimento de uma apresentação encaixada na frente
    // pro final do dia, e ela ficava esperando lá atrás.
    // Eventos especiais (Almoço, Premiação...) da pista que ficam depois
    // do ponto de inserção também têm um bloco correspondente na fila de
    // aquecimento (ver autoGenerate/insertSpecial) — o aquecimento novo
    // precisa entrar ANTES dele também, senão a apresentação (que fica
    // antes do evento na pista) esperaria um aquecimento que só acontece
    // depois do evento.
    const laterSpecialCounts = new Map<string, number>();
    for (const e of matSiblings.slice(insertAt)) {
      if (
        e.linkedEntryId === null &&
        e.type !== ScheduleEntryType.PRESENTATION &&
        e.type !== ScheduleEntryType.WARMUP
      ) {
        const key = `${e.type}|${e.label ?? ''}`;
        laterSpecialCounts.set(key, (laterSpecialCounts.get(key) ?? 0) + 1);
      }
    }
    let warmupInsertAt = warmupSiblings.length;
    let laterLinkedId: string | null = null;
    for (let i = 0; i < warmupSiblings.length; i++) {
      const e = warmupSiblings[i];
      if (
        e.type === ScheduleEntryType.WARMUP &&
        e.linkedEntryId !== null &&
        laterPresentationIds.has(e.linkedEntryId)
      ) {
        warmupInsertAt = i;
        laterLinkedId = e.linkedEntryId;
        break;
      }
      if (e.linkedEntryId === null && e.type !== ScheduleEntryType.WARMUP) {
        const key = `${e.type}|${e.label ?? ''}`;
        const remaining = laterSpecialCounts.get(key) ?? 0;
        if (remaining > 0) {
          warmupInsertAt = i;
          break;
        }
      }
    }
    // A espera de disponibilidade da apresentação seguinte fica junto do
    // aquecimento dela (não separa os dois).
    if (laterLinkedId !== null) {
      while (
        warmupInsertAt > 0 &&
        warmupSiblings[warmupInsertAt - 1].type === ScheduleEntryType.BREAK &&
        warmupSiblings[warmupInsertAt - 1].linkedEntryId === laterLinkedId
      ) {
        warmupInsertAt--;
      }
    }
    const naturalWarmupStart =
      day.startMinutes +
      warmupSiblings
        .slice(0, warmupInsertAt)
        .reduce((sum, e) => sum + e.durationMinutes, 0);

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

    // "Primeira apresentação da pista" = nenhuma apresentação entre os
    // irmãos que ficam ANTES do ponto de inserção — não é simplesmente
    // "a pista está vazia", porque o usuário pode inserir uma
    // apresentação na frente de outras já agendadas (ela vira a
    // primeira mesmo com apresentações depois dela).
    const hasPrecedingPresentation = matSiblings
      .slice(0, insertAt)
      .some((e) => e.type === ScheduleEntryType.PRESENTATION);
    const gapMinutes = hasPrecedingPresentation ? day.defaultGapMinutes : 0;
    const presentationStartMinutes =
      day.startMinutes +
      matSiblings
        .slice(0, insertAt)
        .reduce((sum, e) => sum + e.durationMinutes, 0) +
      gapMinutes;

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
      await this.insertIntoResource(warmupResource.id, warmupInsertAt, {
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

    // Reusa o mesmo `insertAt` de propósito — inserir de novo na mesma
    // posição empurra o que já foi inserido ali (a apresentação, e o
    // "Aguardando aquecimento" se houver) um lugar adiante, deixando o
    // intervalo sempre como o primeiro dos dois: [intervalo] [Aguardando
    // aquecimento, se houver] [apresentação].
    if (gapMinutes > 0) {
      await this.insertIntoResource(resource.id, insertAt, {
        type: ScheduleEntryType.BREAK,
        durationMinutes: gapMinutes,
        label: INTERVAL_BREAK_LABEL,
        linkedEntryId: presentation.id,
      });
    }

    const warmupOrder = warmupInsertAt + (warmupDelayMinutes > 0 ? 1 : 0);
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
    return this.computeTeamBusyWindows(resources, allEntries, day, teamId, excludeEntryIds);
  }

  // Mesmo cálculo de getTeamBusyWindows, mas a partir de dados JÁ
  // CARREGADOS (recursos + entries do dia inteiro), sem consulta nova
  // ao banco — usada pelos laços de reconciliação abaixo, que chamavam
  // getTeamBusyWindows uma vez POR AQUECIMENTO revisado a cada
  // iteração do próprio while (achado 2026-09-22: causa raiz da
  // lentidão relatada pelo usuário ao mover/criar apresentações — cada
  // chamada refazia 2 consultas cobrindo o dia inteiro). O chamador
  // busca resources+entries uma vez por iteração e reaproveita pra
  // todos os itens dela.
  private computeTeamBusyWindows(
    resources: ScheduleResource[],
    allEntries: ScheduleEntry[],
    day: ScheduleDay,
    teamId: string,
    excludeEntryIds?: ReadonlySet<string>,
  ): { start: number; end: number }[] {
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
    const resourceIds = resources.map((r) => r.id);

    for (const resource of warmupResources) {
      let safety = 0;
      // Reinicia do começo do recurso sempre que uma espera é
      // removida/ajustada/inserida (a lista de entries muda), até não
      // sobrar mais nenhuma pra corrigir — `safety` só evita loop
      // infinito se algo inesperado deixar de convergir.
      while (safety++ < 50) {
        // Uma única leitura do dia inteiro por iteração — usada tanto
        // pras entries deste recurso quanto por computeTeamBusyWindows
        // logo abaixo (ver comentário lá pra motivo/data do fix).
        const allEntries = resourceIds.length
          ? await this.entriesRepo.find({ where: { resourceId: In(resourceIds) } })
          : [];
        const entries = allEntries
          .filter((e) => e.resourceId === resource.id)
          .sort((a, b) => a.order - b.order);

        // Espelho da limpeza de reconcileMatGaps — remove "Aguardando
        // disponibilidade da equipe" que ficaram perdidos (não estão
        // mais IMEDIATAMENTE antes do próprio aquecimento vinculado à
        // mesma apresentação), pelo mesmo motivo: inserir um aquecimento
        // "na frente" de outro (`insertAt`/troca de ordem) pode empurrar
        // um intervalo que já pertencia certinho a ele.
        let removedOrphan = false;
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          if (
            e.type !== ScheduleEntryType.BREAK ||
            e.label !== 'Aguardando disponibilidade da equipe' ||
            !e.linkedEntryId
          ) {
            continue;
          }
          const next = entries[i + 1];
          const isCorrectlyPlaced =
            !!next &&
            next.type === ScheduleEntryType.WARMUP &&
            next.linkedEntryId === e.linkedEntryId;
          if (!isCorrectlyPlaced) {
            await this.entriesRepo.remove(e);
            await this.renumberResource(resource.id);
            removedOrphan = true;
            break;
          }
        }
        if (removedOrphan) continue;

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
          const busyWindows = this.computeTeamBusyWindows(
            resources,
            allEntries,
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
    return this.computeResourceEntryTimes(entries, resourceId, dayStartMinutes);
  }

  // Mesmo cálculo de getResourceEntryTimes, mas a partir de uma lista
  // de entries JÁ CARREGADA (pode ser do dia inteiro — filtra por
  // `resourceId` internamente), sem consulta nova ao banco. Mesmo
  // motivo/data do fix de computeTeamBusyWindows acima (2026-09-22).
  private computeResourceEntryTimes(
    entries: ScheduleEntry[],
    resourceId: string,
    dayStartMinutes: number,
  ): Map<string, { start: number; end: number }> {
    const times = new Map<string, { start: number; end: number }>();
    const sorted = entries
      .filter((e) => e.resourceId === resourceId)
      .sort((a, b) => a.order - b.order);
    let cursor = dayStartMinutes;
    for (const entry of sorted) {
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
    const resourceIds = resources.map((r) => r.id);

    for (const resource of matResources) {
      let safety = 0;
      while (safety++ < 50) {
        // Leitura única do dia inteiro por iteração — cobre tanto as
        // entries deste recurso quanto a busca do aquecimento vinculado
        // (antes era uma query por apresentação, ver comentário no
        // trecho abaixo que a substituiu).
        const allEntries = resourceIds.length
          ? await this.entriesRepo.find({ where: { resourceId: In(resourceIds) } })
          : [];
        const entries = allEntries
          .filter((e) => e.resourceId === resource.id)
          .sort((a, b) => a.order - b.order);

        // Limpa intervalos "Aguardando aquecimento" perdidos — não
        // estão mais IMEDIATAMENTE antes da própria apresentação
        // vinculada. Acontece quando outra apresentação é inserida
        // "na frente" (`insertAt` menor) empurrando um intervalo que já
        // pertencia certinho a uma apresentação mais adiante, sem que
        // nada reconheça que aquele intervalo "andou" de lugar (2026-07-27,
        // achado testando várias movimentações seguidas na mesma dupla
        // equipe+pista — ver CLAUDE.md). Sem essa limpeza, o loop
        // abaixo (que só olha o item IMEDIATAMENTE anterior de cada
        // apresentação) nunca reconhece o intervalo órfão como "seu" e
        // cria um novo do zero, deixando o antigo pra trás pra sempre.
        let removedOrphan = false;
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          if (
            e.type !== ScheduleEntryType.BREAK ||
            e.label !== 'Aguardando aquecimento' ||
            !e.linkedEntryId
          ) {
            continue;
          }
          const next = entries[i + 1];
          if (!next || next.id !== e.linkedEntryId) {
            await this.entriesRepo.remove(e);
            await this.renumberResource(resource.id);
            removedOrphan = true;
            break;
          }
        }
        if (removedOrphan) continue;

        let elapsed = 0;
        let changed = false;
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          if (entry.type !== ScheduleEntryType.PRESENTATION) {
            elapsed += entry.durationMinutes;
            continue;
          }

          const warmup = allEntries.find(
            (e) =>
              e.linkedEntryId === entry.id &&
              e.type === ScheduleEntryType.WARMUP,
          );
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

          const warmupTimes = this.computeResourceEntryTimes(
            allEntries,
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

  // Garante que, pra uma mesma equipe, a ordem dos aquecimentos (na fila
  // do recurso de aquecimento) bate com a ordem cronológica das
  // apresentações correspondentes — nunca dois aquecimentos da mesma
  // equipe seguidos com as duas apresentações só depois (2026-07-27, a
  // pedido do usuário: precisa ser intercalado,
  // aquecimento->apresentação->aquecimento->apresentação). Criar ou
  // mover uma apresentação pode deixar o aquecimento de OUTRA
  // apresentação (não criada/movida agora) da mesma equipe fora de
  // ordem, porque createPresentationWithWarmup sempre insere o
  // aquecimento novo no FIM da fila, sem considerar se isso deixa dois
  // aquecimentos da mesma equipe adjacentes. Corrige TROCANDO A ORDEM
  // (não o conteúdo) dos dois aquecimentos invertidos — cada aquecimento
  // continua vinculado (linkedEntryId) à própria apresentação, só a
  // posição na fila muda — repetindo até não sobrar par invertido.
  // Só considera pares no MESMO recurso de aquecimento (equipe com
  // categorias em pistas/aquecimentos pareados diferentes não tem esse
  // conflito, já que são filas independentes).
  private async reconcileTeamWarmupOrder(
    dayId: string,
    teamId: string,
  ): Promise<void> {
    const day = await this.daysRepo.findOneBy({ id: dayId });
    if (!day) return;

    let safety = 0;
    while (safety++ < 20) {
      const resources = await this.resourcesRepo.find({
        where: { scheduleDayId: dayId },
      });
      const resourceIds = resources.map((r) => r.id);
      const allEntries = resourceIds.length
        ? await this.entriesRepo.find({ where: { resourceId: In(resourceIds) } })
        : [];
      const timesByResource = new Map<
        string,
        Map<string, { start: number; end: number }>
      >();
      for (const resource of resources) {
        timesByResource.set(
          resource.id,
          this.computeResourceEntryTimes(
            allEntries,
            resource.id,
            day.startMinutes,
          ),
        );
      }

      const teamWarmups = allEntries.filter(
        (e) =>
          e.type === ScheduleEntryType.WARMUP &&
          e.teamId === teamId &&
          e.linkedEntryId,
      );

      let swapped = false;
      for (const a of teamWarmups) {
        for (const b of teamWarmups) {
          if (a.id === b.id || a.resourceId !== b.resourceId) continue;
          if (a.order >= b.order) continue; // só olha cada par uma vez
          const presentationA = allEntries.find(
            (e) => e.id === a.linkedEntryId,
          );
          const presentationB = allEntries.find(
            (e) => e.id === b.linkedEntryId,
          );
          if (!presentationA || !presentationB) continue;
          const timeA = timesByResource
            .get(presentationA.resourceId)
            ?.get(presentationA.id);
          const timeB = timesByResource
            .get(presentationB.resourceId)
            ?.get(presentationB.id);
          if (!timeA || !timeB) continue;
          // a aquece antes de b na fila, mas a apresenta DEPOIS de b —
          // par invertido, troca a ordem dos dois aquecimentos.
          if (timeA.start > timeB.start) {
            const aOrder = a.order;
            const bOrder = b.order;
            await this.entriesRepo.update(a.id, { order: bOrder });
            await this.entriesRepo.update(b.id, { order: aOrder });
            swapped = true;
            break;
          }
        }
        if (swapped) break;
      }
      if (!swapped) break;
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
  // Uma apresentação vem sempre precedida das esperas/intervalos
  // automáticos ligados a ela (linkedEntryId). Se `index` aponta pra uma
  // dessas esperas ou pra própria apresentação, devolve o índice do
  // início do grupo — inserir algo ali dentro separaria a espera da
  // apresentação a que ela pertence.
  private snapToPresentationGroupStart(
    entries: ScheduleEntry[],
    index: number,
  ): number {
    const target = entries[index];
    if (!target) return index;
    const presentationId =
      target.type === ScheduleEntryType.PRESENTATION
        ? target.id
        : target.type === ScheduleEntryType.BREAK
          ? target.linkedEntryId
          : null;
    if (!presentationId) return index;
    let start = index;
    while (
      start > 0 &&
      entries[start - 1].type === ScheduleEntryType.BREAK &&
      entries[start - 1].linkedEntryId === presentationId
    ) {
      start--;
    }
    return start;
  }

  // `preferForPresentationIds`: apresentações que ficam DEPOIS do ponto
  // de inserção na pista — quando há mais de uma área de aquecimento,
  // prefere as que já têm o aquecimento de alguma delas, pra a nova
  // entrar na frente (na mesma ordem relativa) em vez de num recurso
  // "mais livre" onde a ordem não corresponde.
  private async getAvailableWarmupResourceForMat(
    day: ScheduleDay,
    matResource: ScheduleResource,
    preferForPresentationIds?: ReadonlySet<string>,
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

    if (preferForPresentationIds && preferForPresentationIds.size > 0) {
      const laterWarmups = await this.entriesRepo.find({
        where: {
          resourceId: In(candidates.map((c) => c.id)),
          type: ScheduleEntryType.WARMUP,
        },
      });
      const preferredResourceIds = new Set(
        laterWarmups
          .filter(
            (e) =>
              e.linkedEntryId !== null &&
              preferForPresentationIds.has(e.linkedEntryId),
          )
          .map((e) => e.resourceId),
      );
      const preferred = candidates.filter((c) => preferredResourceIds.has(c.id));
      if (preferred.length > 0) {
        return this.pickLeastElapsedResource(preferred);
      }
    }
    return this.pickLeastElapsedResource(candidates);
  }

  private async pickLeastElapsedResource(
    candidates: ScheduleResource[],
  ): Promise<ScheduleResource> {
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
      // 5 min (era 0) — pedido do usuário 2026-08-05: dia novo sem
      // nenhum intervalo entre apresentações raramente é o que se
      // quer de verdade, e o organizador sempre pode zerar depois pela
      // própria barra de configurações do dia.
      defaultGapMinutes: 5,
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
        // "Palco 1" (era "Pista 1", 2026-08-05, pedido do usuário) — só
        // o nome padrão sugerido; o organizador renomeia livremente
        // depois via CRUD de recursos, isso não afeta nada mais (nome
        // é `varchar` livre, não um enum/tipo fixo).
        name: 'Palco 1',
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

  // Público — usado por ScoringService (tela de lançar notas) pra
  // validar um entryId sem já saber de qual dia/recurso ele é (mesmo
  // raciocínio de findResourceInEventOrThrow). Só entries de
  // apresentação fazem sentido pra pontuação, mas a checagem de `type`
  // fica por conta de quem chama, não daqui.
  async findEntryInEventOrThrow(
    eventId: string,
    entryId: string,
  ): Promise<ScheduleEntry> {
    const entry = await this.entriesRepo.findOneBy({ id: entryId });
    if (!entry)
      throw new NotFoundException('Item do cronograma não encontrado');
    await this.findResourceInEventOrThrow(eventId, entry.resourceId);
    return entry;
  }

  // Grava quando a equipe solicitou contestação (ver
  // ScoringService.requestContestation, que já validou dono +
  // liberação antes de chamar isto) — idempotente, não sobrescreve um
  // pedido já registrado.
  async setContestationRequested(
    eventId: string,
    entryId: string,
  ): Promise<void> {
    const entry = await this.findEntryInEventOrThrow(eventId, entryId);
    if (entry.contestationRequestedAt) return;
    entry.contestationRequestedAt = new Date();
    await this.entriesRepo.save(entry);

    const event = await this.eventsService.findEventOrThrow(eventId);
    const team = entry.teamId
      ? await this.teamsRepo.findOneBy({ id: entry.teamId })
      : null;
    await this.notificationsService.create(
      event.aliasId,
      NotificationType.CONTESTATION_REQUESTED,
      NotificationAudience.STAFF,
      `Contestação solicitada para ${team?.name ?? 'Equipe'}`,
      entry.id,
    );
  }

  // Setter puro — toda a validação de elegibilidade (quem pode, time é
  // dele, ainda não foi avaliada) já rodou em
  // ScoringService.withdrawPresentation antes de chamar isto. Mesmo
  // padrão de setContestationRequested: persiste a flag e já dispara a
  // notificação daqui (tem os dois — repo/nome do time e
  // notificationsService — à mão).
  async setWithdrawn(
    eventId: string,
    entryId: string,
    options: { removeFromSchedule: boolean },
  ): Promise<void> {
    const entry = await this.findEntryInEventOrThrow(eventId, entryId);
    entry.withdrawnAt = new Date();
    entry.removedFromSchedule = options.removeFromSchedule;
    await this.entriesRepo.save(entry);

    const event = await this.eventsService.findEventOrThrow(eventId);
    const team = entry.teamId
      ? await this.teamsRepo.findOneBy({ id: entry.teamId })
      : null;
    await this.notificationsService.create(
      event.aliasId,
      NotificationType.PRESENTATION_CANCELLED,
      NotificationAudience.ALL,
      `${team?.name ?? 'Equipe'} cancelada`,
      entry.id,
    );
  }

  // Jurado marca a contestação como resolvida (ver
  // ScoringService.resolveContestation, que já validou que a
  // apresentação tem contestação solicitada antes de chamar isto) —
  // idempotente, não sobrescreve uma resolução já registrada.
  // `contestationRequestedAt` nunca é limpo (é o que trava "uma única
  // contestação por apresentação").
  async setContestationResolved(
    eventId: string,
    entryId: string,
  ): Promise<void> {
    const entry = await this.findEntryInEventOrThrow(eventId, entryId);
    if (entry.contestationResolvedAt) return;
    entry.contestationResolvedAt = new Date();
    await this.entriesRepo.save(entry);
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

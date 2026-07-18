import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CriterionJudgeAssignment } from '../entities/criterion-judge-assignment.entity';
import { SpecialRoleAssignment } from '../entities/special-role-assignment.entity';
import { SpecialJudgeRole } from '../enums/special-judge-role.enum';
import { BulkAssignStrategy } from '../dto/bulk-assign.dto';
import { Category } from '../../categories/entities/category.entity';
import { ScoringCriterionType } from '../../scoring-templates/enums/scoring-criterion-type.enum';
import { ScoringCriteriaService } from '../../scoring-templates/services/scoring-criteria.service';
import { JudgesService } from '../../judges/services/judges.service';
import { EventsService } from '../../events/services/events.service';
import { ScheduleService } from '../../schedule/services/schedule.service';

export interface JudgingDayView {
  id: string;
  date: string;
  dayIndex: number;
  resources: Array<{ id: string; name: string }>;
}

export interface CriterionAssignmentsState {
  days: JudgingDayView[];
  criterionAssignments: Array<{ criterionId: string; resourceId: string; judgeIds: string[] }>;
}

@Injectable()
export class JudgingService {
  constructor(
    @InjectRepository(CriterionJudgeAssignment)
    private readonly criterionAssignmentsRepo: Repository<CriterionJudgeAssignment>,
    @InjectRepository(SpecialRoleAssignment)
    private readonly specialRoleAssignmentsRepo: Repository<SpecialRoleAssignment>,
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    private readonly scoringCriteriaService: ScoringCriteriaService,
    private readonly judgesService: JudgesService,
    private readonly eventsService: EventsService,
    private readonly scheduleService: ScheduleService,
  ) {}

  async getAssignments(
    eventId: string,
    templateId: string,
    userId: string,
  ): Promise<CriterionAssignmentsState> {
    const criteria = await this.assertTemplateUsableForEvent(
      eventId,
      templateId,
      userId,
    );
    const criterionIds = criteria.map((c) => c.id);
    const days = await this.getRelevantDays(eventId, templateId);
    const resourceIds = days.flatMap((d) => d.resources.map((r) => r.id));

    const criterionRows =
      criterionIds.length && resourceIds.length
        ? await this.criterionAssignmentsRepo
            .createQueryBuilder('assignment')
            .where('assignment.criterionId IN (:...criterionIds)', {
              criterionIds,
            })
            .andWhere('assignment.resourceId IN (:...resourceIds)', {
              resourceIds,
            })
            .getMany()
        : [];
    const byKey = new Map<
      string,
      { criterionId: string; resourceId: string; judgeIds: string[] }
    >();
    for (const row of criterionRows) {
      const key = `${row.criterionId}:${row.resourceId}`;
      const entry = byKey.get(key) ?? {
        criterionId: row.criterionId,
        resourceId: row.resourceId,
        judgeIds: [],
      };
      entry.judgeIds.push(row.judgeParticipationId);
      byKey.set(key, entry);
    }

    return {
      days: days.map((d) => ({
        id: d.id,
        date: d.date,
        dayIndex: d.dayIndex,
        resources: d.resources,
      })),
      criterionAssignments: Array.from(byKey.values()),
    };
  }

  // Dias do evento com apresentação agendada de alguma categoria que
  // usa este template, e os recursos (pistas) de cada um — são as
  // "colunas" válidas da árvore de critérios (ver
  // ScheduleService.findResourcesWithScheduledCategories). Reusado
  // tanto por getAssignments quanto pela validação de
  // setCriterionJudges/bulkAssign (um resourceId só é aceito se
  // aparecer aqui).
  private async getRelevantDays(
    eventId: string,
    templateId: string,
  ): Promise<JudgingDayView[]> {
    const categories = await this.categoriesRepo.find({
      where: { eventId, scoringTemplateId: templateId },
      select: ['id'],
    });
    return this.scheduleService.findResourcesWithScheduledCategories(
      eventId,
      categories.map((c) => c.id),
    );
  }

  private async assertResourceUsableForTemplate(
    eventId: string,
    templateId: string,
    resourceId: string,
  ): Promise<void> {
    const days = await this.getRelevantDays(eventId, templateId);
    const valid = days.some((d) => d.resources.some((r) => r.id === resourceId));
    if (!valid) {
      throw new BadRequestException(
        'Este recurso não tem apresentações agendadas para este sistema de pontuação',
      );
    }
  }

  // Funções especiais não dependem de template, mas dependem do
  // RECURSO (2026-07-19, a pedido do usuário — mesma razão da
  // atribuição por recurso na árvore de critérios: um jurado não pode
  // estar em duas pistas ao mesmo tempo). Método público reusável
  // tanto por quem monta a tela de escala (um recurso por vez) quanto
  // por quem só precisa saber se uma função específica (ex: Jurado de
  // Legalidade) já foi preenchida EM TODOS os recursos/dias do evento
  // (ex: checklist de setup do evento — ver EventSetupPage).
  async getSpecialRoles(
    eventId: string,
    resourceId: string,
  ): Promise<Array<{ role: SpecialJudgeRole; judgeIds: string[] }>> {
    await this.scheduleService.findResourceInEventOrThrow(eventId, resourceId);
    const specialRoleRows = await this.specialRoleAssignmentsRepo.find({
      where: { eventId, resourceId },
    });
    const byRole = new Map<SpecialJudgeRole, string[]>();
    for (const row of specialRoleRows) {
      const list = byRole.get(row.role) ?? [];
      list.push(row.judgeParticipationId);
      byRole.set(row.role, list);
    }
    return Object.values(SpecialJudgeRole).map((role) => ({
      role,
      judgeIds: byRole.get(role) ?? [],
    }));
  }

  // Substitui o conjunto inteiro de jurados de UMA folha — usado pelo
  // drop de um jurado isolado (front lê o estado atual, adiciona, e
  // manda o conjunto final) e pelo checklist do painel lateral.
  async setCriterionJudges(
    eventId: string,
    templateId: string,
    criterionId: string,
    resourceId: string,
    judgeIds: string[],
    userId: string,
  ): Promise<void> {
    const criteria = await this.assertTemplateUsableForEvent(
      eventId,
      templateId,
      userId,
    );
    const criterion = criteria.find((c) => c.id === criterionId);
    if (!criterion) {
      throw new BadRequestException(
        'Critério não pertence a este sistema de pontuação',
      );
    }
    if (criterion.type !== ScoringCriterionType.SCORE_ITEM) {
      throw new BadRequestException(
        'Só critérios-folha (item de avaliação) recebem jurados diretamente',
      );
    }
    await this.assertResourceUsableForTemplate(eventId, templateId, resourceId);
    await this.assertJudgesBelongToEvent(eventId, judgeIds);
    await this.replaceCriterionJudges(criterionId, resourceId, judgeIds);
  }

  // Soltar sobre um GRUPO: resolve todas as folhas descendentes e
  // aplica a estratégia escolhida em cada uma, numa transação lógica
  // (sequencial — volume de folhas por template é pequeno).
  async bulkAssign(
    eventId: string,
    templateId: string,
    groupCriterionId: string,
    resourceId: string,
    judgeParticipationId: string,
    strategy: BulkAssignStrategy,
    userId: string,
  ): Promise<void> {
    const criteria = await this.assertTemplateUsableForEvent(
      eventId,
      templateId,
      userId,
    );
    const group = criteria.find((c) => c.id === groupCriterionId);
    if (!group) {
      throw new BadRequestException(
        'Critério não pertence a este sistema de pontuação',
      );
    }
    await this.assertResourceUsableForTemplate(eventId, templateId, resourceId);
    await this.assertJudgesBelongToEvent(eventId, [judgeParticipationId]);

    const leafIds = this.getDescendantLeafIds(criteria, groupCriterionId);
    if (leafIds.length === 0) return;

    const existing = await this.criterionAssignmentsRepo
      .createQueryBuilder('assignment')
      .where('assignment.criterionId IN (:...leafIds)', { leafIds })
      .andWhere('assignment.resourceId = :resourceId', { resourceId })
      .getMany();
    const byCriterion = new Map<string, string[]>();
    for (const row of existing) {
      const list = byCriterion.get(row.criterionId) ?? [];
      list.push(row.judgeParticipationId);
      byCriterion.set(row.criterionId, list);
    }

    for (const leafId of leafIds) {
      const current = byCriterion.get(leafId) ?? [];
      let next: string[];
      switch (strategy) {
        case BulkAssignStrategy.UNASSIGNED_ONLY:
          next = current.length === 0 ? [judgeParticipationId] : current;
          break;
        case BulkAssignStrategy.REPLACE:
          next = [judgeParticipationId];
          break;
        case BulkAssignStrategy.ADD:
        default:
          next = current.includes(judgeParticipationId)
            ? current
            : [...current, judgeParticipationId];
          break;
      }
      await this.replaceCriterionJudges(leafId, resourceId, next);
    }
  }

  async setSpecialRoleJudges(
    eventId: string,
    role: SpecialJudgeRole,
    resourceId: string,
    judgeIds: string[],
  ): Promise<void> {
    await this.scheduleService.findResourceInEventOrThrow(eventId, resourceId);
    await this.assertJudgesBelongToEvent(eventId, judgeIds);
    await this.specialRoleAssignmentsRepo.delete({
      eventId,
      role,
      resourceId,
    });
    if (judgeIds.length === 0) return;
    const rows = judgeIds.map((judgeParticipationId) =>
      this.specialRoleAssignmentsRepo.create({
        eventId,
        resourceId,
        role,
        judgeParticipationId,
      }),
    );
    await this.specialRoleAssignmentsRepo.save(rows);
  }

  private async replaceCriterionJudges(
    criterionId: string,
    resourceId: string,
    judgeIds: string[],
  ): Promise<void> {
    await this.criterionAssignmentsRepo.delete({ criterionId, resourceId });
    if (judgeIds.length === 0) return;
    const rows = judgeIds.map((judgeParticipationId) =>
      this.criterionAssignmentsRepo.create({
        criterionId,
        resourceId,
        judgeParticipationId,
      }),
    );
    await this.criterionAssignmentsRepo.save(rows);
  }

  private getDescendantLeafIds(
    criteria: Array<{
      id: string;
      parentId: string | null;
      type: ScoringCriterionType;
    }>,
    rootId: string,
  ): string[] {
    const childrenByParent = new Map<string, typeof criteria>();
    for (const c of criteria) {
      if (!c.parentId) continue;
      const list = childrenByParent.get(c.parentId) ?? [];
      list.push(c);
      childrenByParent.set(c.parentId, list);
    }
    const leafIds: string[] = [];
    const stack = [...(childrenByParent.get(rootId) ?? [])];
    while (stack.length) {
      const node = stack.pop()!;
      if (node.type === ScoringCriterionType.SCORE_ITEM) {
        leafIds.push(node.id);
      } else {
        stack.push(...(childrenByParent.get(node.id) ?? []));
      }
    }
    return leafIds;
  }

  private async assertJudgesBelongToEvent(
    eventId: string,
    judgeIds: string[],
  ): Promise<void> {
    for (const judgeId of judgeIds) {
      await this.judgesService.findJudgeOrThrow(eventId, judgeId);
    }
  }

  // Confere que o template pertence ao usuário (via
  // ScoringCriteriaService.findAllForTemplate, que já valida ownership)
  // E que está de fato em uso por alguma Category deste evento — não
  // basta ser "um template meu qualquer".
  private async assertTemplateUsableForEvent(
    eventId: string,
    templateId: string,
    userId: string,
  ) {
    await this.eventsService.findEventOrThrow(eventId);
    const criteria = await this.scoringCriteriaService.findAllForTemplate(
      templateId,
      userId,
    );
    const inUse = await this.categoriesRepo.count({
      where: { eventId, scoringTemplateId: templateId },
    });
    if (inUse === 0) {
      throw new BadRequestException(
        'Este sistema de pontuação não está em uso por nenhuma categoria deste evento',
      );
    }
    return criteria;
  }
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { EventStatus } from '../enums/event-status.enum';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'competition_days' })
  competitionDays: number;

  @Column({ length: 150 })
  location: string;

  // Nome do local físico (ex. "Expominas"), separado de `location`
  // (cidade/UF). Opcional — nem todo evento informa.
  @Column({ type: 'varchar', nullable: true })
  venue: string | null;

  @Column({ name: 'logo_url', type: 'varchar', nullable: true })
  logoUrl: string | null;

  // Código de compartilhamento (QR + texto) — igual ao aliasId, é
  // estável através das versões: gerado uma única vez na CRIAÇÃO do
  // evento (EventsService.createEvent, desde 2026-09-23 — antes só
  // nascia no primeiro publish) e carregado adiante em toda
  // republicação seguinte, nunca muda depois disso. Único no banco
  // (índice parcial, só entre linhas não-nulas). `nullable` só por
  // causa de evento criado antes dessa mudança (publishEvent tem um
  // fallback que gera na primeira publicação, pra esses casos).
  @Column({ name: 'event_code', type: 'varchar', length: 16, nullable: true })
  eventCode: string | null;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.CREATED })
  status: EventStatus;

  // Preenchido por EventsService.startEvent quando o evento vira
  // "started" — não faz parte do publishEvent (reseta a cada nova
  // versão publicada, já que uma versão nova ainda não foi iniciada).
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  // Preenchido por EventsService.completeEvent quando o evento vira
  // "completed" (started -> completed, ação manual do admin/assessor,
  // sem regra automática por data — ver CLAUDE.md "Próximos passos").
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  // OBSOLETAS desde 2026-09-24: a liberação passou a ser por categoria
  // em cada dia (ver CategoryDayRelease/ReleasesService). As colunas
  // ficam no banco (a migration CreateCategoryDayReleases copiou o
  // valor delas pra category_day_releases), mas não são mais lidas.
  @Column({ name: 'scores_released_at', type: 'timestamptz', nullable: true })
  scoresReleasedAt: Date | null;

  @Column({
    name: 'contestation_released_at',
    type: 'timestamptz',
    nullable: true,
  })
  contestationReleasedAt: Date | null;

  @Column({ name: 'results_released_at', type: 'timestamptz', nullable: true })
  resultsReleasedAt: Date | null;

  // Identidade lógica do evento através das versões — o `id` é
  // específico de cada linha/versão, o `aliasId` é o mesmo em todas as
  // versões de um mesmo evento (é através dele que EventMember vincula
  // usuários ao evento, não pelo `id`). Ver EventsService.publishEvent.
  @Index()
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  // Só uma linha por aliasId pode estar active=true por vez (garantido
  // por índice único parcial na migration). Ao publicar uma nova
  // versão, a linha antiga é marcada active=false (mas continua no
  // banco pra histórico/auditoria) e uma linha nova é inserida.
  @Column({ default: true })
  active: boolean;

  @Index()
  @Column({ name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  // Não são colunas — populadas por EventsService (findAllForUser via
  // subquery de COUNT; findOneForUser buscando Category/
  // ProgramParticipation/JudgeParticipation direto pelo aliasId), só
  // para telas de listagem/configuração do evento e pro card "Início"
  // do painel ao vivo (contagem visível pra qualquer papel, diferente
  // da lista/detalhe — ver ProgramsController/JudgesController, ambos
  // admin/assessor-only). Category/ProgramParticipation/
  // JudgeParticipation não têm mais relação TypeORM com Event
  // (endereçadas por aliasId, sem FK) — ver migration
  // AddAliasIdToEventScopedChildEntities.
  categoriesCount?: number;
  programsCount?: number;
  judgesCount?: number;
  categoriesUpdatedAt?: Date | null;
  programsUpdatedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

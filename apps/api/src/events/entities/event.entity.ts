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
  // estável através das versões: gerado uma única vez no primeiro
  // publish (EventsService.publishEvent) e carregado adiante em toda
  // republicação seguinte, nunca muda depois disso. Único no banco
  // (índice parcial, só entre linhas não-nulas). Só existe a partir do
  // primeiro publish — evento em "created" ainda não tem.
  @Column({ name: 'event_code', type: 'varchar', length: 16, nullable: true })
  eventCode: string | null;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.CREATED })
  status: EventStatus;

  // Preenchido por EventsService.startEvent quando o evento vira
  // "started" — não faz parte do publishEvent (reseta a cada nova
  // versão publicada, já que uma versão nova ainda não foi iniciada).
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  // Liberação de notas/contestação/resultado pra equipe/atletas — ação
  // global do evento (não mais por apresentação, ver EventsService.
  // setReleaseFlags), pensada pro produtor liberar tudo de uma vez ao
  // fim da competição em vez de visitar apresentação por apresentação.
  // Estado mutável simples (não event-sourced): é "a última vontade do
  // admin". Ligar `contestationReleasedAt` liga `scoresReleasedAt`
  // junto (não dá pra contestar sem poder ver a nota); desligar
  // `scoresReleasedAt` desliga `contestationReleasedAt` junto.
  // `resultsReleasedAt` (resultado final/ranking) é independente — não
  // participa dessa cascata, um produtor pode querer revelar o
  // resultado final sem abrir o detalhamento de notas por critério.
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
  // ProgramParticipation direto pelo aliasId), só para telas de
  // listagem/configuração do evento. Category/ProgramParticipation não
  // têm mais relação TypeORM com Event (endereçadas por aliasId, sem
  // FK) — ver migration AddAliasIdToEventScopedChildEntities.
  categoriesCount?: number;
  programsCount?: number;
  categoriesUpdatedAt?: Date | null;
  programsUpdatedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

// Um dia de competição dentro do evento. Nasce por get-or-create (ver
// ScheduleService.getDays) — `dayIndex` 1..event.competitionDays na
// primeira chamada; dias extras (além da contagem original do evento)
// entram via `ScheduleService.addDay`.
@Entity('schedule_days')
@Unique(['aliasId', 'dayIndex'])
export class ScheduleDay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Identifica o evento pelo aliasId (estável entre versões), não pelo
  // id de uma versão específica — sem FK, mesmo padrão de
  // EventMember.aliasId. Ver migration AddAliasIdToEventScopedChildEntities.
  @Index()
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  @Column({ name: 'day_index', type: 'int' })
  dayIndex: number;

  @Column({ type: 'date' })
  date: string;

  // Minutos desde 00:00 (ex: 480 = 08:00) — inteiro pra fazer conta
  // fácil, formatado só na exibição (frontend).
  @Column({ name: 'start_minutes', type: 'int', default: 480 })
  startMinutes: number;

  @Column({ name: 'end_minutes', type: 'int', default: 1200 })
  endMinutes: number;

  @Column({ name: 'default_warmup_minutes', type: 'int', default: 10 })
  defaultWarmupMinutes: number;

  // Marcado pelo produtor quando este dia especificamente não precisa
  // ter todas as equipes/categorias do evento agendadas (ex: um dia
  // com menos categorias por design) — com isso, a etapa "Cronograma"
  // do setup do evento conta esse dia como completo mesmo com
  // apresentações pendentes nele (ver EventSetupPage/eventSetupSteps).
  // Não afeta o dia em si (o painel "Equipes não agendadas" continua
  // mostrando as pendências normalmente, é só a contagem de conclusão
  // do setup que ignora).
  @Column({
    name: 'ignore_unscheduled_presentations',
    type: 'boolean',
    default: false,
  })
  ignoreUnscheduledPresentations: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

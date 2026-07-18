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
import { ScheduleDay } from './schedule-day.entity';

// Uma linha da timeline dentro de um dia — genérica de propósito: o
// nome é livre (o organizador digita "Tapete Azul", "Isolamento 1",
// "Palco Secundário", o que fizer sentido pro evento), sem um "tipo"
// fixo em enum/código. Gerenciada via CRUD próprio (ver
// ScheduleService.createResource/updateResource/removeResource/
// moveResource) — não existe mais sincronização automática por
// contagem (matCount/warmupAreaCount, removidos de ScheduleDay).
//
// `supportsPresentations` é a única distinção comportamental que o
// backend precisa: só recursos com essa flag podem receber uma
// entrada `presentation` (ver ScheduleService.createPresentationWithWarmup).
// `pairedResourceId` é o recurso pra onde vai o aquecimento
// automático quando uma apresentação é agendada aqui — também livre,
// escolhido pelo organizador entre os recursos do mesmo dia (não é
// mais um pareamento cíclico por índice).
@Entity('schedule_resources')
export class ScheduleResource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'schedule_day_id' })
  scheduleDayId: string;

  @ManyToOne(() => ScheduleDay, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schedule_day_id' })
  scheduleDay: ScheduleDay;

  @Column({ length: 100 })
  name: string;

  // Hex livre, escolhido pelo organizador entre uma paleta fixa no
  // frontend (ver apps/web/src/lib/avatarColor.ts) — nullable porque
  // recursos criados antes dessa coluna existir não têm valor; o
  // frontend cai pra uma cor determinística (hash do id) nesse caso.
  @Column({ type: 'varchar', length: 20, nullable: true })
  color: string | null;

  @Column({ name: 'supports_presentations', default: false })
  supportsPresentations: boolean;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ name: 'paired_resource_id', type: 'uuid', nullable: true })
  pairedResourceId: string | null;

  @ManyToOne(() => ScheduleResource, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'paired_resource_id' })
  pairedResource: ScheduleResource | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

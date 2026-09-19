import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { SpecialEventDto } from '../dto/special-event.dto';
import {
  AutoGenerateLevelDirection,
  AutoGenerateOrderPrimary,
} from '../enums/auto-generate-order.enum';

// Parâmetros do "gerar automaticamente" (engrenagem ao lado do botão),
// UMA linha por evento (aliasId, estável entre republicações, sem FK —
// mesmo padrão de ScheduleDay/Category). Vale pra todos os dias do
// evento e pra qualquer admin/assessor. Sem linha = padrão (formato
// primeiro, nível crescente, formatos na ordem padrão) — a linha só
// nasce na primeira vez que alguém salva a engrenagem.
@Entity('schedule_auto_settings')
export class ScheduleAutoSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  @Column({
    name: 'order_primary',
    type: 'varchar',
    default: AutoGenerateOrderPrimary.FORMAT,
  })
  orderPrimary: AutoGenerateOrderPrimary;

  @Column({
    name: 'level_direction',
    type: 'varchar',
    default: AutoGenerateLevelDirection.ASC,
  })
  levelDirection: AutoGenerateLevelDirection;

  // Ordem de preferência dos formatos DO EVENTO (só os que existem nas
  // categorias dele): chaves de autoFormatKey — formato fixo ou
  // `custom:<rótulo>`. Formato ausente da lista cai no fim, na ordem
  // padrão (ver ScheduleService.autoGenerate).
  @Column({ name: 'format_order', type: 'jsonb', default: () => `'[]'` })
  formatOrder: string[];

  // Eventos especiais da geração automática (Almoço, Abertura...), com
  // a posição de cada um — lembrados por evento pra voltarem
  // preenchidos na próxima geração.
  @Column({ name: 'special_events', type: 'jsonb', default: () => `'[]'` })
  specialEvents: SpecialEventDto[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

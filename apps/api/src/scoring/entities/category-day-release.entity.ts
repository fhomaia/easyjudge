import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { ScheduleDay } from '../../schedule/entities/schedule-day.entity';

// Liberação de notas/contestação/resultado por CATEGORIA em um DIA do
// cronograma (2026-09-24, substitui as 3 chaves globais do Event): em
// evento com mais de uma premiação, cada categoria é liberada quando a
// premiação dela acontece. Sem linha = nada liberado. As apresentações
// de uma categoria num dia são liberadas juntas; se a categoria se
// apresenta em outro dia, lá é outra linha.
@Entity('category_day_releases')
@Unique(['scheduleDayId', 'categoryId'])
export class CategoryDayRelease {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // aliasId do evento (mesmo padrão dos outros filhos de evento) — só
  // pra buscar tudo de um evento numa consulta.
  @Index()
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  @Column({ name: 'schedule_day_id', type: 'uuid' })
  scheduleDayId: string;

  @ManyToOne(() => ScheduleDay, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schedule_day_id' })
  scheduleDay: ScheduleDay;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

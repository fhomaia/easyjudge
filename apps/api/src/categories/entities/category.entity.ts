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
import { Event } from '../../events/entities/event.entity';
import { CategoryStatus } from '../enums/category-status.enum';
import { CategoryModality } from '../enums/category-modality.enum';
import { CategoryDivision } from '../enums/category-division.enum';
import { CategoryFormat } from '../enums/category-format.enum';

// A regra de pontuação (dificuldade, execução, deduções etc.) vinculada
// a cada categoria ainda não foi modelada — entra em uma iteração futura.
@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'event_id' })
  eventId: string;

  @ManyToOne(() => Event, (event) => event.categories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'enum', enum: CategoryModality })
  modality: CategoryModality;

  @Column({ type: 'enum', enum: CategoryDivision })
  division: CategoryDivision;

  // Importante porque as regras de segurança são definidas por formato
  // (não confundir com `modality`, que é All Star/Universitário/Escolar).
  @Column({ name: 'category_format', type: 'enum', enum: CategoryFormat })
  categoryFormat: CategoryFormat;

  // Só preenchido quando categoryFormat = 'custom' — o nome do formato
  // customizado digitado pelo usuário (ex: "Freestyle Pom"), usado na
  // montagem do nome da categoria no lugar do rótulo genérico "Custom".
  @Column({ name: 'custom_format_label', type: 'varchar', nullable: true })
  customFormatLabel: string | null;

  // Vai de 1 a 7, aceitando até uma casa decimal (ex: 3.5) — por isso
  // 'float' em vez de 'int'.
  @Column({ type: 'float' })
  level: number;

  @Column({ name: 'non_tumbling', default: false })
  nonTumbling: boolean;

  // Só existem esses dois estados (decisão do usuário) — nada de
  // "rascunho" ou outros status intermediários.
  @Column({ type: 'enum', enum: CategoryStatus, default: CategoryStatus.ACTIVE })
  status: CategoryStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

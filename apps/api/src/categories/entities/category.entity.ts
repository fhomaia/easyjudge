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
import { ScoringTemplate } from '../../scoring-templates/entities/scoring-template.entity';
import { CategoryStatus } from '../enums/category-status.enum';
import { CategoryModality } from '../enums/category-modality.enum';
import { CategoryDivision } from '../enums/category-division.enum';
import { CategoryFormat } from '../enums/category-format.enum';

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

  // Nullable no banco (categorias criadas antes dessa feature não têm),
  // mas obrigatório no CreateCategoryDto. Front-end pré-preenche um
  // default por categoryFormat/modality (team_cheer: 2:30, exceto
  // school/university que são 2:45; demais formatos: 1:00) — usuário
  // pode ajustar antes de salvar. Alimenta o cronograma do evento numa
  // etapa futura.
  @Column({ name: 'presentation_time_seconds', type: 'int', nullable: true })
  presentationTimeSeconds: number | null;

  // Nullable no banco (categorias criadas antes dessa feature não têm),
  // mas obrigatório na criação via CreateCategoryDto — só um template
  // "completo" (soma dos critérios-raiz == targetScore) pode ser
  // atribuído, ver ScoringTemplatesService.assertUsableTemplate.
  @Index()
  @Column({ name: 'scoring_template_id', nullable: true })
  scoringTemplateId: string | null;

  @ManyToOne(() => ScoringTemplate)
  @JoinColumn({ name: 'scoring_template_id' })
  scoringTemplate: ScoringTemplate | null;

  // Só existem esses dois estados (decisão do usuário) — nada de
  // "rascunho" ou outros status intermediários.
  @Column({ type: 'enum', enum: CategoryStatus, default: CategoryStatus.ACTIVE })
  status: CategoryStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

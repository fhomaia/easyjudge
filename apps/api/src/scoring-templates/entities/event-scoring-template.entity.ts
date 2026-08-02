import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ScoringTemplate } from './scoring-template.entity';

// Curadoria de "quais sistemas de pontuação valem pra este evento"
// (2026-08-02, pedido do usuário na tela de Regulamento) — filtra o
// seletor de categoria (CategoryFormFields), mas não é uma trava de
// permissão: uma categoria pode continuar usando um template mesmo
// depois dele ter sido removido da seleção (ver
// ScoringTemplatesService.removeFromEventSelection).
//
// Escopado por `aliasId`, não pelo `id` de uma versão específica do
// evento — mesmo padrão de Category/Team/Program, estável através de
// republicações (ver comentário equivalente em ScheduleController).
@Entity('event_scoring_templates')
@Index(['aliasId', 'templateId'], { unique: true })
export class EventScoringTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'alias_id' })
  aliasId: string;

  @Column({ name: 'template_id' })
  templateId: string;

  @ManyToOne(() => ScoringTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: ScoringTemplate;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

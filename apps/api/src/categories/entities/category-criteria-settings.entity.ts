import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { CategoryCriterion } from '../category-criteria';

// Critérios de divisão de categoria de UM evento (aliasId, sem FK, mesmo
// padrão de ScheduleAutoSettings): quais estão ligados, a ordem (que
// monta o nome da categoria) e as opções de cada um. Sem linha = padrão
// (defaultCategoryCriteria: Vínculo, Gênero e Nível ligados, como era
// antes dos critérios configuráveis).
@Entity('category_criteria_settings')
export class CategoryCriteriaSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  @Column({ type: 'jsonb' })
  criteria: CategoryCriterion[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

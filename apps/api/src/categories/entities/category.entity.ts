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
import { ScoringTemplate } from '../../scoring-templates/entities/scoring-template.entity';
import { CategoryStatus } from '../enums/category-status.enum';
import { CategoryFormat } from '../enums/category-format.enum';
import type { CategoryCriterionKey } from '../enums/category-criterion-key.enum';

// Rótulo de um critério ligado no evento, montado na leitura (não é
// coluna), na ordem configurada: o front usa pra tabela, cartões e
// filtros sem precisar conhecer as opções.
// Regra efetiva da categoria (conferida no envio da inscrição): a da
// opção de Tamanho/Faixa etária escolhida ou, sem ela, a regra direta.
// null = sem limite.
export interface CategoryRules {
  minAthletes: number | null;
  maxAthletes: number | null;
  minAge: number | null;
  maxAge: number | null;
  // Data em que a idade é conferida (YYYY-MM-DD).
  ageCutoffDate: string | null;
}

export interface CategoryCriterionLabel {
  key: CategoryCriterionKey;
  // Id da opção, ou o próprio nível ("4.2", "4-nt") no Nível.
  value: string;
  label: string;
}

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Identifica o evento pelo aliasId (estável entre versões), não pelo
  // id de uma versão específica — sem FK, mesmo padrão de
  // EventMember.aliasId. Ver migration AddAliasIdToEventScopedChildEntities.
  @Index()
  @Column({ name: 'alias_id', type: 'uuid' })
  aliasId: string;

  @Column({ length: 150 })
  name: string;

  // Critérios de divisão (2026-10-06): cada um guarda o id de uma opção
  // da configuração do evento (CategoryCriteriaSettings), ou null quando
  // o critério está desligado. Vínculo institucional e Gênero reusam as
  // colunas antigas `modality`/`division` (antes enum, hoje varchar); os
  // ids das opções padrão são os valores antigos dos enums.
  @Column({ name: 'modality', type: 'varchar', nullable: true })
  institution: string | null;

  @Column({ type: 'varchar', nullable: true })
  regime: string | null;

  @Column({ name: 'age_group', type: 'varchar', nullable: true })
  ageGroup: string | null;

  @Column({ name: 'division', type: 'varchar', nullable: true })
  gender: string | null;

  // Só em modalidade de grupo (ver sizeRuleFor).
  @Column({ type: 'varchar', nullable: true })
  size: string | null;

  // Importante porque as regras de segurança são definidas por formato
  // (não confundir com `institution`, que é All Star/Universitário/Escolar).
  @Column({ name: 'category_format', type: 'enum', enum: CategoryFormat })
  categoryFormat: CategoryFormat;

  // Só preenchido quando categoryFormat = 'custom' — o nome do formato
  // customizado digitado pelo usuário (ex: "Freestyle Pom"), usado na
  // montagem do nome da categoria no lugar do rótulo genérico "Custom".
  @Column({ name: 'custom_format_label', type: 'varchar', nullable: true })
  customFormatLabel: string | null;

  // Parte inteira = nível de construção (1 a 7); casa decimal = nível de
  // tumbling (1 a 7) quando é diferente: 4.2 = construção 4, tumbling 2
  // (ver levelProblem). Obrigatório na API; a coluna aceita null só por
  // compatibilidade com a migration (não há categoria sem nível).
  @Column({ type: 'float', nullable: true })
  level: number | null;

  // Regra direta da categoria (2026-10-06), pra quem não quer criar uma
  // opção de Tamanho/Faixa etária: só vale quando a categoria não usa a
  // divisão correspondente (CategoriesService limpa ao escolher uma).
  @Column({ name: 'min_athletes', type: 'int', nullable: true })
  minAthletes: number | null;

  @Column({ name: 'max_athletes', type: 'int', nullable: true })
  maxAthletes: number | null;

  @Column({ name: 'min_age', type: 'int', nullable: true })
  minAge: number | null;

  @Column({ name: 'max_age', type: 'int', nullable: true })
  maxAge: number | null;

  // Data em que a idade da regra direta é conferida (YYYY-MM-DD). Null =
  // a da Faixa etária do evento (por padrão, a data do evento).
  @Column({ name: 'age_cutoff_date', type: 'date', nullable: true })
  ageCutoffDate: string | null;

  // "Sem tumbling" do Nível (nível sempre inteiro nesse caso).
  @Column({ name: 'non_tumbling', default: false })
  nonTumbling: boolean;

  // Nullable no banco (categorias criadas antes dessa feature não têm),
  // mas obrigatório no CreateCategoryDto. Front-end pré-preenche um
  // default por modalidade, vínculo e regime (team_cheer: 2:30, exceto
  // school/university que são 2:45; demais formatos: 1:00) — usuário
  // pode ajustar antes de salvar. Alimenta o cronograma do evento numa
  // etapa futura.
  @Column({ name: 'presentation_time_seconds', type: 'int', nullable: true })
  presentationTimeSeconds: number | null;

  // Diferente de presentationTimeSeconds, este é obrigatório de verdade
  // (banco NOT NULL, com backfill na migration — categorias diferentes
  // pedem preparo bem diferente: 1min de stunt não exige o mesmo
  // aquecimento que uma rotina de Team Cheer de 2:30). Front-end
  // pré-preenche 10min pra Team Cheer, 5min pros demais formatos —
  // usuário pode ajustar antes de salvar. Substitui o antigo
  // ScheduleDay.defaultWarmupMinutes (config única por dia, removida).
  @Column({ name: 'warmup_minutes', type: 'int' })
  warmupMinutes: number;

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
  @Column({
    type: 'enum',
    enum: CategoryStatus,
    default: CategoryStatus.ACTIVE,
  })
  status: CategoryStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Não são colunas: preenchidos por CategoryCriteriaService.attachLabels.
  criteriaLabels?: CategoryCriterionLabel[];
  rules?: CategoryRules;
}

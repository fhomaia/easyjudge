import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ScoringCriterion } from './scoring-criterion.entity';

// Template de pontuação reutilizável entre eventos (não pertence a um
// evento específico — é uma biblioteca pessoal do usuário, atribuída a
// categorias depois, em uma etapa futura). Ver CLAUDE.md.
@Entity('scoring_templates')
export class ScoringTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Meta de pontos do template inteiro — a soma dos critérios-raiz
  // (maxScore) é validada contra este valor na tela de construção.
  @Column({ name: 'target_score', type: 'float', default: 100 })
  targetScore: number;

  @Index()
  @Column({ name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  // Modelo de sistema (2026-08-02): pertence a uma conta reservada, não
  // a um usuário real — ver SYSTEM_SCORING_TEMPLATES_OWNER_ID na
  // migration AddSystemScoringTemplates. Nunca editável/excluível por
  // ninguém (createdById aponta pra essa conta, que ninguém loga),
  // visível/clonável por qualquer usuário (ScoringTemplatesService.
  // findAllForUser/findViewableTemplateOrThrow). Não faz parte de
  // Create/UpdateScoringTemplateDto — só setável via migration.
  @Column({ name: 'is_system_template', default: false })
  isSystemTemplate: boolean;

  // Nome do órgão de origem (ex. "International Cheer Union") — os
  // modelos de sistema são de autoria de órgãos oficiais da comunidade
  // cheer, não da Cheer Cup; mostrado no badge do card e no banner de
  // atribuição do builder/PDF exportado. Nulo pra todo template comum.
  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @OneToMany(() => ScoringCriterion, (criterion) => criterion.template)
  criteria: ScoringCriterion[];

  // Não é coluna — preenchida via loadRelationCountAndMap em
  // ScoringTemplatesService.findAllForUser, só para a listagem.
  criteriaCount?: number;

  // Não é coluna — soma do maxScore dos critérios-raiz, preenchida em
  // ScoringTemplatesService.findAllForUser, só para a listagem (permite
  // mostrar "completo"/"incompleto" sem buscar a árvore inteira).
  distributedScore?: number;

  // Não é coluna — "completo" = distributedScore bate com targetScore E
  // nenhum grupo (em qualquer nível) está sem nenhum item de avaliação
  // descendente. Preenchida em ScoringTemplatesService.findAllForUser;
  // fonte única de verdade pro frontend, evita recomputar a regra em
  // cada tela (CategoriesPage, EventSetupPage, ScoringTemplateCard).
  isComplete?: boolean;

  // Não é coluna — verdadeiro quando o template está em uso por uma
  // categoria de um evento (versão ativa) cujo status já saiu de
  // "created". Preenchida em ScoringTemplatesService.findAllForUser/
  // findOneForUser; enquanto travado, o template/seus critérios não
  // podem ser editados (ver ScoringTemplatesService.
  // assertNotLockedForEditing) — evita invalidar notas já lançadas ou
  // a estrutura que jurados já estão usando ao vivo.
  isLocked?: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

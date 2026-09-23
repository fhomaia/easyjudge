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

// Uma regra de dedução do template — `id` é a chave usada nas notas
// (score_events.deduction_type): ou um dos 9 ids padrão da IASF (ver
// enums/deduction-type.enum.ts, só usados pra semear um template novo)
// ou `custom_<uuid>` (linha adicionada pelo usuário). Sem distinção de
// origem depois de criada — o usuário edita/apaga/adiciona livremente,
// não existe mais conceito de "modo IASF vs Personalizado" (2026-09-23,
// ver CLAUDE.md). `value` fica sempre <= 0 (soma ao total = subtrai).
export interface TemplateDeduction {
  id: string;
  label: string;
  value: number;
  // Quando true, a tela do jurado de legalidade exige uma especificação
  // de texto livre ao aplicar esta dedução (ex.: qual regra de
  // legalidade foi infringida) — ver ScoreEventKind.DEDUCTION_CODE_SET.
  // Pedido do usuário (2026-09-23): antes disso era travado no id fixo
  // "legality_infractions"; agora qualquer regra (padrão ou
  // personalizada) pode exigir.
  requiresCode: boolean;
}

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

  // Ano/temporada de vigência das regras (ex. 2026) — badge próprio ao
  // lado do de `source`, já que órgãos oficiais costumam revisar o
  // código anualmente e um mesmo órgão pode acabar tendo mais de um
  // modelo de sistema (anos diferentes) na biblioteca ao mesmo tempo.
  // Nulo pra todo template comum. Mesmo padrão de isSystemTemplate/
  // source: fora de Create/UpdateScoringTemplateDto, só setável via
  // migration.
  @Column({ type: 'int', nullable: true })
  year: number | null;

  // Regras de dedução deste template — todo template novo (do zero ou
  // clonado) nasce semeado com as 9 regras padrão da IASF (ver
  // ScoringTemplatesService.create/constants/iasf-deductions.ts) e o
  // usuário edita/apaga/adiciona a partir daí. Compartilhada por todo
  // evento que usa este template (mesmo espírito de critérios/
  // targetScore, que já são compartilhados) — travada pra edição junto
  // com o resto do template (ver assertNotLockedForEditing).
  @Column({ type: 'jsonb', default: () => `'[]'` })
  deductions: TemplateDeduction[];

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

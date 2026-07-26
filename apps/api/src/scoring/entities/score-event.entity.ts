import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ScoreEventKind } from '../enums/score-event-kind.enum';
import { DeductionType } from '../../regulations/enums/deduction-type.enum';

// Tabela append-only (só INSERT, nunca UPDATE/DELETE) — é a peça que
// implementa "notas nunca podem ser perdidas" (ver CLAUDE.md,
// Requisitos não-negociáveis). "Estado atual" de uma apresentação
// nunca é lido de uma coluna mutável daqui — é sempre RECALCULADO
// reduzindo a lista de eventos (ver ScoringService/lib/scoreEvents.ts
// no frontend): score de um critério = valor do último SCORE_SET
// daquele criterionId; deduções ativas = todo DEDUCTION_ADD cujo id
// não aparece como undoesEventId de nenhum DEDUCTION_REMOVE;
// comentário/esboço = texto do último COMMENT_SET/SKETCH_SET.
//
// `id` é gerado NO CLIENTE (crypto.randomUUID()), não pelo banco — é o
// que permite reenviar o mesmo evento depois de uma falha de rede sem
// duplicar (ScoringService.submitEvents faz INSERT ... ON CONFLICT
// (id) DO NOTHING).
//
// `scheduleEntryId`/`judgeParticipationId` são colunas simples, SEM FK
// — mesmo raciocínio de EventMember.aliasId: um evento de nota já
// gravado não pode virar órfão/sumir por causa de uma edição de
// cronograma ou remoção de um jurado do catálogo.
@Entity('score_events')
export class ScoreEvent {
  @PrimaryColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'schedule_entry_id' })
  scheduleEntryId: string;

  @Index()
  @Column({ name: 'judge_participation_id' })
  judgeParticipationId: string;

  // Quem de fato realizou a ação, quando diferente do dono da nota
  // (`judgeParticipationId`) — preenchido só quando um Head Judge edita
  // a folha de outro jurado (ver ScoringService.submitEventsAsHeadJudge).
  // `null` = o próprio dono lançou, é o caso normal. Sem FK, mesmo
  // raciocínio de judgeParticipationId acima.
  @Column({ name: 'entered_by_judge_participation_id', type: 'uuid', nullable: true })
  enteredByJudgeParticipationId: string | null;

  @Column({ type: 'enum', enum: ScoreEventKind })
  kind: ScoreEventKind;

  // SCORE_SET
  @Column({ name: 'criterion_id', type: 'uuid', nullable: true })
  criterionId: string | null;

  @Column({ type: 'float', nullable: true })
  value: number | null;

  // DEDUCTION_ADD
  @Column({
    name: 'deduction_type',
    type: 'enum',
    enum: DeductionType,
    nullable: true,
  })
  deductionType: DeductionType | null;

  // DEDUCTION_REMOVE — aponta pro id do DEDUCTION_ADD sendo desfeito;
  // desfazer também é um INSERT novo, nunca apaga o evento original.
  @Column({ name: 'undoes_event_id', type: 'uuid', nullable: true })
  undoesEventId: string | null;

  // DEDUCTION_ADD — timestamp tipo "01:15.3" relativo ao início
  // cronometrado da apresentação.
  @Column({ name: 'presentation_elapsed_ms', type: 'int', nullable: true })
  presentationElapsedMs: number | null;

  // COMMENT_SET (o comentário) ou SKETCH_SET (dataURL PNG do canvas).
  @Column({ type: 'text', nullable: true })
  text: string | null;

  // Hora do NAVEGADOR no momento do evento — autoritativa pra ordem
  // cronológica de exibição. `createdAt` (recebimento no servidor) só
  // reflete quando o retry conseguiu entregar, que pode ser bem depois
  // se o jurado ficou offline — não serve pra ordenar a UI.
  @Column({ name: 'client_created_at', type: 'timestamptz' })
  clientCreatedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

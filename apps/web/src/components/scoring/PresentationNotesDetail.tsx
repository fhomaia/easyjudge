import type { ReactNode } from "react";
import { AlertTriangle, Scale } from "lucide-react";
import { formatElapsed } from "@/lib/deductionIcons";
import { DEDUCTION_LABELS } from "@/lib/deductionLabels";
import { ScoringSummary } from "@/components/scoring/ScoringSummary";
import { HitZeroCelebration } from "@/components/scoring/HitZeroCelebration";
import { sumMaxScores } from "@/lib/scoringSummary";
import { isPresentationHitZero } from "@/lib/hitZero";
import type { PresentationDetail } from "@/api/client";

// Visão somente-leitura de UMA apresentação — todos os grupos do
// sistema de pontuação + legalidade JUNTOS. Quando um critério tem mais
// de um jurado atribuído, `criterion.value` já vem como a média das
// notas (ver ScoringService.computeAverageScoreByCriterion) — esta
// tela mostra só o valor final, sem listar jurado por jurado. Reusada
// pelo admin/assessor (sem restrição) e pelo Programa (só das próprias
// equipes, já liberado). `actions` é o slot pras ações que variam por
// quem está olhando (toggles de liberação pro admin, botão de
// contestar pro Programa).
//
// `celebrateHitZero` (2026-08-01): só true nos consumidores
// Programa/Atleta (EventLiveTeamNotesPage/AthletePresentationDetailPanel)
// — o admin/assessor vê toda súmula do evento, inclusive de rotinas
// alheias, então a celebração não faz sentido pra esse papel (é uma
// comemoração da PRÓPRIA equipe, não uma métrica de gestão).
interface PresentationNotesDetailProps {
  detail: PresentationDetail;
  actions?: ReactNode;
  celebrateHitZero?: boolean;
}

export function PresentationNotesDetail({
  detail,
  actions,
  celebrateHitZero = false,
}: PresentationNotesDetailProps) {
  // Toca sempre que a súmula for aberta (sem "só na primeira vez" —
  // decisão do usuário), então o `key` no componente pai precisa mudar
  // por apresentação pra reiniciar a animação a cada seleção.
  const isHitZero = celebrateHitZero && isPresentationHitZero(detail);

  // Total (soma de TODOS os critérios, de todos os jurados) + soma das
  // deduções (já vêm com `value` negativo do backend — ver
  // ScoringService.buildPresentationDetail) + resultado final — mesmo
  // resumo já usado na súmula do próprio jurado (ver ScoringSummary),
  // só que agregado pra apresentação inteira em vez de um jurado só.
  const totalScore = detail.groups
    .flatMap((g) => g.criteria)
    .reduce((sum, c) => sum + (c.value ?? 0), 0);
  const deductionsTotal = detail.legality
    ? detail.legality.deductions.reduce((sum, d) => sum + d.value, 0)
    : 0;
  const finalResult = totalScore + deductionsTotal;
  const maxScore = sumMaxScores(detail.groups);

  return (
    <div className="space-y-4">
      {isHitZero && <HitZeroCelebration key={detail.presentation.id} />}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-foreground">{detail.presentation.teamName}</p>
          <p className="text-sm text-muted-foreground">
            {detail.presentation.categoryName} · {detail.presentation.resourceName}
          </p>
        </div>
        {detail.contestationRequested && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600">
            <AlertTriangle className="size-3.5" />
            Contestação solicitada
          </span>
        )}
      </div>

      <ScoringSummary
        totalScore={totalScore}
        hasCriteria={detail.groups.length > 0}
        deductionsTotal={deductionsTotal}
        isLegalityJudge={detail.legality !== null}
        finalResult={finalResult}
        maxScore={maxScore}
        variant="desktop"
      />

      {actions}

      {detail.groups.map((group) => (
        <div key={group.id} className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-bold tracking-wide text-foreground">{group.name}</p>
          <div className="mt-2 divide-y divide-border">
            {group.criteria.map((criterion) => (
              <div key={criterion.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{criterion.name}</p>
                </div>
                <span className="w-16 shrink-0 rounded-lg bg-muted py-1.5 text-center text-base font-bold tabular-nums text-foreground">
                  {criterion.value !== null ? criterion.value.toFixed(1) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {detail.legality && (
        <div className="rounded-2xl border border-red-300/50 bg-red-500/5 p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold tracking-wide text-red-600">
            <Scale className="size-4" />
            LEGALIDADE
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{detail.legality.judgeName}</p>
          {detail.legality.deductions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma dedução registrada.</p>
          ) : (
            <div className="mt-3 divide-y divide-border">
              {detail.legality.deductions.map((d, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <span className="w-14 shrink-0 text-xs font-medium text-red-600">
                    {d.presentationElapsedMs !== null ? formatElapsed(d.presentationElapsedMs) : "--:--"}
                  </span>
                  <span className="flex-1 text-sm text-foreground">{DEDUCTION_LABELS[d.type]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {detail.notes.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-bold tracking-wide text-foreground">NOTAS DOS JURADOS</p>
          <div className="mt-2 space-y-3">
            {detail.notes.map((note, i) => (
              <div key={i} className="rounded-xl bg-muted p-3">
                <p className="text-xs font-semibold text-muted-foreground">{note.judgeName}</p>
                {note.comment && <p className="mt-1 text-sm text-foreground">{note.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

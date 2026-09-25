import { AlertTriangle, Scale } from "lucide-react";
import { BandBadge } from "@/components/scoring/CurrentBandBadge";
import { criterionBandForScore } from "@/lib/scoreBands";
import { formatCriterionScore } from "@/lib/formatNumber";
import { criteriaWithSubgroups, isStandaloneCriterion } from "@/lib/criteriaWithSubgroups";
import { formatElapsed } from "@/lib/deductionIcons";
import { ScoringSummary } from "@/components/scoring/ScoringSummary";
import { HitZeroCelebration } from "@/components/scoring/HitZeroCelebration";
import { sumMaxScores } from "@/lib/scoringSummary";
import { isPresentationHitZero } from "@/lib/hitZero";
import type { PresentationDetail, PresentationDetailCriterion } from "@/api/client";

// Visão somente-leitura de UMA apresentação — todos os grupos do
// sistema de pontuação + legalidade JUNTOS. Quando um critério tem mais
// de um jurado atribuído, `criterion.value` já vem como a média das
// notas (ver ScoringService.computeAverageScoreByCriterion) — esta
// tela mostra só o valor final, sem listar jurado por jurado. Reusada
// pelo admin/assessor (sem restrição) e pelo Programa (só das próprias
// equipes, já liberado). Ações que variam por quem está olhando (ex:
// "Solicitar contestação" do Programa) ficam no TOPO da tela de quem
// chama esta view, ao lado do "Voltar" — não são mais um slot aqui
// dentro (2026-08-01: o botão de contestar era `w-full` no meio da
// súmula, pedido do usuário pra virar compacto e subir pro topo).
//
// `celebrateHitZero` (2026-08-01): só true nos consumidores
// Programa/Atleta (EventLiveTeamNotesPage/AthletePresentationDetailPanel)
// — o admin/assessor vê toda súmula do evento, inclusive de rotinas
// alheias, então a celebração não faz sentido pra esse papel (é uma
// comemoração da PRÓPRIA equipe, não uma métrica de gestão).
interface PresentationNotesDetailProps {
  detail: PresentationDetail;
  celebrateHitZero?: boolean;
}

// Faixa (ou valor fixo) em que a nota do critério caiu (mesma regra da
// tela do jurado). Nada quando o critério não usa faixas/valores fixos
// ou está sem nota.
function CriterionBand({ criterion }: { criterion: PresentationDetailCriterion }) {
  const band = criterionBandForScore(criterion, criterion.value);
  return band ? <BandBadge band={band} /> : null;
}

export function PresentationNotesDetail({
  detail,
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

      {detail.groups.map((group) =>
        isStandaloneCriterion(group) ? (
          // Critério solto no primeiro nível da árvore (sem grupo): uma
          // linha só, sem repetir o nome como título e como item.
          <div key={group.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold tracking-wide text-foreground">{group.name}</p>
              <CriterionBand criterion={group.criteria[0]} />
            </div>
            <span className="w-16 shrink-0 rounded-lg bg-muted py-1.5 text-center text-base font-bold tabular-nums text-foreground">
              {formatCriterionScore(group.criteria[0].value)}
            </span>
          </div>
        ) : (
        <div key={group.id} className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-bold tracking-wide text-foreground">{group.name}</p>
          <div className="mt-2 divide-y divide-border">
            {criteriaWithSubgroups(group.criteria).map((row, i) =>
              row.kind === "subgroup" ? (
                <p
                  key={`sub-${i}`}
                  style={{ paddingLeft: `${row.depth * 12}px` }}
                  className="pt-3 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {row.label}
                </p>
              ) : (
                <div key={row.criterion.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div style={{ paddingLeft: `${row.criterion.subgroupPath.length * 12}px` }}>
                      <p className="truncate text-sm text-foreground">{row.criterion.name}</p>
                      <CriterionBand criterion={row.criterion} />
                    </div>
                  </div>
                  <span className="w-16 shrink-0 rounded-lg bg-muted py-1.5 text-center text-base font-bold tabular-nums text-foreground">
                    {formatCriterionScore(row.criterion.value)}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
        ),
      )}

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
                  <span className="flex-1 text-sm text-foreground">{d.label}</span>
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

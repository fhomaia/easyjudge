import { useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Info, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CriterionInfoPopover } from "@/components/scoring/CriterionInfoPopover";
import { CurrentBandBadge } from "@/components/scoring/CurrentBandBadge";
import { ScoreBandSlider } from "@/components/scoring/ScoreBandSlider";
import type { ScoringCriterionView, ScoringGroupView } from "@/api/client";

// Extraído de EventLiveScoringPage/EventLiveScoringDesktopView pra ser
// reusado também pelo Painel Head Judge (folha de OUTRO jurado, ver
// HeadJudgePanel/HeadJudgeMobileSheet) — mesmo componente, três
// consumidores. `variant` só ajusta densidade (tamanho de botão/fonte,
// margens), o comportamento é idêntico.
//
// `showScoreBands` (default false) liga descrição-clicável de
// grupo/critério, o nome/cor da faixa atual embaixo de "Nota máxima" e
// (só variant="desktop") o slider colorido por faixa — desligado por
// padrão de propósito: o Painel Head Judge (HeadJudgeJudgeSheet) reusa
// este mesmo componente e não deve ganhar nenhuma dessas novidades, só
// os dois consumidores da folha do próprio jurado passam `true`.
interface ScoringCriteriaGroupsProps {
  groups: ScoringGroupView[];
  scores: Record<string, number>;
  collapsedGroups: Set<string>;
  onToggleGroup: (groupId: string) => void;
  isGroupComplete: (criteriaIds: string[]) => boolean;
  onAdjustScore: (criterionId: string, maxScore: number, allowDecimal: boolean, direction: 1 | -1) => void;
  onSetScore: (criterionId: string, maxScore: number, allowDecimal: boolean, rawValue: number) => void;
  variant?: "mobile" | "desktop";
  showScoreBands?: boolean;
}

export function ScoringCriteriaGroups({
  groups,
  scores,
  collapsedGroups,
  onToggleGroup,
  isGroupComplete,
  onAdjustScore,
  onSetScore,
  variant = "mobile",
  showScoreBands = false,
}: ScoringCriteriaGroupsProps) {
  const isMobile = variant === "mobile";
  // O campo de nota é sempre um input de verdade — digita direto em
  // cima do valor, sem precisar clicar antes pra "entrar em modo de
  // edição". Enquanto focado mostra o texto que o jurado está digitando
  // (`editingValue`); ao perder o foco (ou Enter) confirma e formata de
  // volta. Esc cancela sem aplicar (via `skipCommitRef`, ver abaixo).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const skipCommitRef = useRef(false);

  function startEditing(criterion: ScoringCriterionView) {
    setEditingId(criterion.id);
    const current = scores[criterion.id];
    setEditingValue(current ? String(current) : "");
  }

  function commitEditing(criterion: ScoringCriterionView) {
    if (editingId !== criterion.id) return;
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      setEditingId(null);
      return;
    }
    const parsed = Number(editingValue.replace(",", "."));
    if (editingValue.trim() !== "" && !Number.isNaN(parsed)) {
      onSetScore(criterion.id, criterion.maxScore, criterion.allowDecimalScoring, parsed);
    }
    setEditingId(null);
  }

  return (
    <>
      {groups.map((group) => {
        const criteriaIds = group.criteria.map((c) => c.id);
        const complete = isGroupComplete(criteriaIds);
        const collapsed = collapsedGroups.has(group.id);
        return (
          <div key={group.id} className={cn("rounded-2xl border border-border bg-card", isMobile && "mx-4 mt-3")}>
            {showScoreBands && group.description ? (
              // Div comum, não `<button>`, porque o ícone de descrição
              // precisa ser um elemento clicável independente — dois
              // `<button>` aninhados seriam HTML inválido e o clique no
              // ícone borbulharia pro toggle do grupo.
              <div className="flex w-full items-center gap-3 p-4 text-left">
                <button
                  type="button"
                  onClick={() => onToggleGroup(group.id)}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border",
                      complete ? "border-emerald-500 bg-emerald-500/15 text-emerald-600" : "border-border text-transparent",
                    )}
                  >
                    <CheckCircle2 className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold tracking-wide text-foreground">
                    {group.name}
                  </span>
                </button>
                <CriterionInfoPopover description={group.description} label={`Descrição de ${group.name}`} />
                <button type="button" onClick={() => onToggleGroup(group.id)} aria-label="Expandir/recolher grupo">
                  {collapsed ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onToggleGroup(group.id)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border",
                    complete ? "border-emerald-500 bg-emerald-500/15 text-emerald-600" : "border-border text-transparent",
                  )}
                >
                  <CheckCircle2 className="size-4" />
                </span>
                <span className="flex-1 text-sm font-bold tracking-wide text-foreground">{group.name}</span>
                {collapsed ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronUp className="size-4 text-muted-foreground" />}
              </button>
            )}
            {!collapsed && (
              <div className="divide-y divide-border border-t border-border px-4">
                {group.criteria.map((criterion) => {
                  const bands = criterion.scoreBands;
                  const hasBands = showScoreBands && criterion.useScoreBands && !!bands && bands.length > 0;
                  const showSlider = hasBands && !isMobile;
                  const score = scores[criterion.id] ?? 0;
                  return (
                    <div key={criterion.id} className={cn(isMobile ? "py-4" : "py-3")}>
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm text-foreground">{criterion.name}</span>
                            {criterion.description &&
                              (showScoreBands ? (
                                <CriterionInfoPopover
                                  description={criterion.description}
                                  label={`Descrição de ${criterion.name}`}
                                />
                              ) : (
                                <Info
                                  className="size-3.5 shrink-0 text-muted-foreground"
                                  aria-label={criterion.description}
                                />
                              ))}
                            {/* Subgrupos intermediários (ex: "Stunt"/"Pyramids"
                                dentro de "Building") não viram uma seção
                                própria — buildGroups achata a árvore em 2
                                níveis — mas cada um com descrição própria
                                ganha o próprio ícone aqui, junto do item. */}
                            {showScoreBands &&
                              criterion.subgroupDescriptions.map((sub) => (
                                <CriterionInfoPopover
                                  key={sub.name}
                                  description={sub.description}
                                  label={`Descrição de ${sub.name}`}
                                />
                              ))}
                          </div>
                          <span className="text-xs text-muted-foreground">Nota máxima: {criterion.maxScore}</span>
                          {/* No desktop o slider já mostra a faixa atual (cor do
                              polegar/trilho) + a descrição dela embaixo — essa
                              linha compacta (nome + ícone) só faz sentido onde
                              não tem slider. */}
                          {hasBands && isMobile && <CurrentBandBadge bands={bands!} score={score} />}
                          {/* Comparação com as outras equipes da mesma
                              categoria — só na folha do próprio jurado
                              (showScoreBands), nunca no Painel Head Judge.
                              No desktop isso vira só a marcação no slider
                              (ver ScoreBandSlider), sem texto solto aqui. */}
                          {showScoreBands && isMobile && criterion.bestScore && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Maior nota:</span>{" "}
                              {criterion.bestScore.value.toFixed(1)}
                              {criterion.bestScore.teamNames.length === 1 &&
                                ` (${criterion.bestScore.teamNames[0]})`}
                            </p>
                          )}
                          {showScoreBands &&
                            isMobile &&
                            criterion.bestScore &&
                            criterion.bestScore.teamNames.length > 1 && (
                              <p className="mt-0.5 text-xs text-amber-600">
                                Mesma nota atribuída às equipes {criterion.bestScore.teamNames.join(", ")}
                              </p>
                            )}
                        </div>
                        <input
                          inputMode="decimal"
                          aria-label={`Nota de ${criterion.name}`}
                          value={editingId === criterion.id ? editingValue : score.toFixed(1)}
                          onFocus={() => startEditing(criterion)}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => commitEditing(criterion)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") {
                              skipCommitRef.current = true;
                              e.currentTarget.blur();
                            }
                          }}
                          className={cn(
                            "w-16 shrink-0 rounded-lg border border-transparent bg-muted text-center font-bold tabular-nums text-foreground outline-none focus-visible:border-primary focus-visible:bg-background",
                            isMobile ? "py-2 text-lg" : "py-1.5 text-base",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => onAdjustScore(criterion.id, criterion.maxScore, criterion.allowDecimalScoring, -1)}
                          aria-label={`Diminuir ${criterion.name}`}
                          className={cn(
                            "flex shrink-0 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted",
                            isMobile ? "size-9" : "size-8",
                          )}
                        >
                          <Minus className={isMobile ? "size-4" : "size-3.5"} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdjustScore(criterion.id, criterion.maxScore, criterion.allowDecimalScoring, 1)}
                          aria-label={`Aumentar ${criterion.name}`}
                          className={cn(
                            "flex shrink-0 items-center justify-center rounded-lg border border-primary/40 text-primary hover:bg-primary/10",
                            isMobile ? "size-9" : "size-8",
                          )}
                        >
                          <Plus className={isMobile ? "size-4" : "size-3.5"} />
                        </button>
                      </div>
                      {showSlider && (
                        <ScoreBandSlider
                          bands={bands!}
                          maxScore={criterion.maxScore}
                          allowDecimal={criterion.allowDecimalScoring}
                          value={score}
                          onValueChange={(next) =>
                            onSetScore(criterion.id, criterion.maxScore, criterion.allowDecimalScoring, next)
                          }
                          teamScores={criterion.teamScores}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

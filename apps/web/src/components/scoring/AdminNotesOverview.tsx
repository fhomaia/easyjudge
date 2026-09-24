import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { AdminNotesOverviewList } from "@/components/scoring/AdminNotesOverviewList";
import { AdminPresentationDetailPanel } from "@/components/scoring/AdminPresentationDetailPanel";
import { ReleaseToggles } from "@/components/scoring/ReleaseToggles";
import { Button } from "@/components/ui/button";
import { downloadPresentationDetailsAsZip, slugify } from "@/lib/presentationDetailExport";
import { formatDayTab } from "@/lib/formatDate";
import { cn } from "@/lib/utils";
import {
  adminScoringApi,
  type AdminOverviewEntry,
  type ReleaseDay,
  type SetReleasePayload,
} from "@/api/client";

// Visão do admin/assessor na tela de Notas: súmulas agrupadas por
// categoria, com a liberação de notas/contestação/resultado por
// categoria em cada dia (2026-09-24, antes eram 3 chaves pro evento
// inteiro). Aba por dia só quando mais de um dia tem apresentação. As
// chaves do topo de cada dia ligam/desligam todas as categorias dele.
// Auto-contido (busca os próprios dados) pra caber tanto no mobile de
// EventLiveNotesPage quanto em EventLiveNotesDesktopView.
interface AdminNotesOverviewProps {
  eventId: string;
  eventName: string;
}

export function AdminNotesOverview({ eventId, eventName }: AdminNotesOverviewProps) {
  const [entries, setEntries] = useState<AdminOverviewEntry[] | null>(null);
  const [days, setDays] = useState<ReleaseDay[] | null>(null);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    adminScoringApi.getOverview(eventId).then(setEntries);
    adminScoringApi.getRelease(eventId).then(setDays);
  }, [eventId]);

  const activeDay = days?.find((d) => d.dayId === activeDayId) ?? days?.[0] ?? null;

  // Súmulas completas por dia+categoria (a lista do backend só traz as
  // 100% pontuadas e as desistências).
  const entriesByGroup = useMemo(() => {
    const map = new Map<string, AdminOverviewEntry[]>();
    for (const entry of entries ?? []) {
      const key = `${entry.scheduleDayId}|${entry.categoryId}`;
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return map;
  }, [entries]);

  async function changeRelease(payload: SetReleasePayload, key: string) {
    setSavingKey(key);
    setError(null);
    try {
      const updated = await adminScoringApi.setRelease(eventId, payload);
      setDays(updated);
      // `released` de cada súmula acompanha a chave de notas.
      setEntries(await adminScoringApi.getOverview(eventId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a liberação.");
    } finally {
      setSavingKey(null);
    }
  }

  // "Baixar todas" — busca o detalhe completo de cada apresentação (a
  // listagem não traz grupos/critérios, só o resumo) e empacota um PDF
  // por apresentação num único .zip (decisão do usuário: zip com PDFs
  // separados, não um PDF gigante). Desistências saem — não têm súmula
  // de verdade (nunca chegam a ter nota).
  async function handleDownloadAll() {
    if (!entries) return;
    const scoredEntries = entries.filter((e) => !e.withdrawn);
    if (scoredEntries.length === 0) return;
    setDownloadingAll(true);
    try {
      const details = await Promise.all(
        scoredEntries.map((entry) => adminScoringApi.getDetail(eventId, entry.scheduleEntryId)),
      );
      await downloadPresentationDetailsAsZip(details, `sumulas-${slugify(eventName)}.zip`);
    } catch (err) {
      console.error("Não foi possível gerar as súmulas.", err);
    } finally {
      setDownloadingAll(false);
    }
  }

  if (selectedId) {
    return (
      <AdminPresentationDetailPanel
        eventId={eventId}
        scheduleEntryId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  if (!entries || !days) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const scoredCount = entries.filter((e) => !e.withdrawn).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">Súmulas ({scoredCount})</p>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => void handleDownloadAll()}
          disabled={downloadingAll || scoredCount === 0}
          aria-label="Baixar todas as súmulas em PDF"
          title="Baixar todas as súmulas em PDF"
        >
          {downloadingAll ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        </Button>
      </div>

      {days.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma apresentação no cronograma ainda.
        </div>
      ) : (
        <>
          {days.length > 1 && (
            <div className="scrollbar-none mb-4 flex items-center gap-1 overflow-x-auto border-b border-border">
              {days.map((day) => (
                <button
                  key={day.dayId}
                  type="button"
                  onClick={() => setActiveDayId(day.dayId)}
                  className={cn(
                    "shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap",
                    day.dayId === activeDay?.dayId
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {formatDayTab(day.date)}
                </button>
              ))}
            </div>
          )}

          {activeDay && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {days.length > 1 ? "Liberar todas as categorias do dia" : "Liberar todas as categorias"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Liga ou desliga de uma vez. Pra liberar aos poucos, use as chaves de cada categoria.
                </p>
                <ReleaseToggles
                  className="mt-3"
                  scoresReleased={activeDay.scoresReleased}
                  contestationReleased={activeDay.contestationReleased}
                  resultsReleased={activeDay.resultsReleased}
                  disabled={savingKey !== null}
                  onChange={(changes) =>
                    void changeRelease({ dayId: activeDay.dayId, ...changes }, activeDay.dayId)
                  }
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              {activeDay.categories.map((category) => {
                const groupEntries =
                  entriesByGroup.get(`${activeDay.dayId}|${category.categoryId}`) ?? [];
                const completeCount = groupEntries.filter((e) => !e.withdrawn).length;
                return (
                  <div key={category.categoryId} className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-sm font-semibold break-words text-foreground">{category.categoryName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {completeCount} de {category.presentationCount} súmula
                      {category.presentationCount === 1 ? "" : "s"} completa
                      {completeCount === 1 ? "" : "s"}
                    </p>
                    <ReleaseToggles
                      className="mt-3"
                      scoresReleased={category.scoresReleased}
                      contestationReleased={category.contestationReleased}
                      resultsReleased={category.resultsReleased}
                      disabled={savingKey !== null}
                      onChange={(changes) =>
                        void changeRelease(
                          { dayId: activeDay.dayId, categoryId: category.categoryId, ...changes },
                          `${activeDay.dayId}|${category.categoryId}`,
                        )
                      }
                    />
                    <div className="mt-3">
                      {groupEntries.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                          Nenhuma súmula completa ainda.
                        </p>
                      ) : (
                        <AdminNotesOverviewList entries={groupEntries} onSelect={setSelectedId} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

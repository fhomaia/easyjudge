import { useEffect, useState } from "react";
import { scoringApi, type HeadJudgeLogEntry, type HeadJudgeRoster } from "@/api/client";

export type HeadJudgePanelTab = "roster" | "log";

// Estado do Painel Head Judge (Modo Supervisão) compartilhado entre a
// versão desktop (aside fixo) e mobile (tela cheia empilhada) — só a
// "casca" (chrome) difere entre as duas, ver HeadJudgePanel/
// HeadJudgeMobileSheet. Aba "Avaliações" (roster) tem um drill-down
// pra dentro (jurado selecionado); aba "Logs" não.
export function useHeadJudgePanelState(eventId: string | undefined, scheduleEntryId: string | undefined) {
  const [activeTab, setActiveTabState] = useState<HeadJudgePanelTab>("roster");
  const [selectedJudgeId, setSelectedJudgeId] = useState<string | null>(null);

  const [roster, setRoster] = useState<HeadJudgeRoster | null>(null);
  const [rosterLoading, setRosterLoading] = useState(true);

  const [log, setLog] = useState<HeadJudgeLogEntry[] | null>(null);
  const [logLoading, setLogLoading] = useState(false);

  function loadRoster() {
    if (!eventId || !scheduleEntryId) return;
    setRosterLoading(true);
    scoringApi.headJudge
      .getRoster(eventId, scheduleEntryId)
      .then(setRoster)
      .finally(() => setRosterLoading(false));
  }

  useEffect(() => {
    loadRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, scheduleEntryId]);

  function setActiveTab(tab: HeadJudgePanelTab) {
    setActiveTabState(tab);
    if (tab === "log" && !log && !logLoading && eventId && scheduleEntryId) {
      setLogLoading(true);
      scoringApi.headJudge
        .getLog(eventId, scheduleEntryId)
        .then(setLog)
        .finally(() => setLogLoading(false));
    }
    if (tab === "roster") setSelectedJudgeId(null);
  }

  function selectJudge(judgeParticipationId: string) {
    setSelectedJudgeId(judgeParticipationId);
  }

  function closeJudgeSheet() {
    setSelectedJudgeId(null);
    // A edição pode ter mudado o status (completo/incompleto) do
    // jurado — reconsulta o roster ao voltar pra lista.
    loadRoster();
  }

  return {
    activeTab,
    setActiveTab,
    roster,
    rosterLoading,
    selectedJudgeId,
    selectJudge,
    closeJudgeSheet,
    log,
    logLoading,
  };
}

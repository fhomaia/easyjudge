import { motion } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeadJudgePanelState } from "@/lib/useHeadJudgePanelState";
import { HeadJudgeRosterList } from "@/components/scoring/HeadJudgeRosterList";
import { HeadJudgeJudgeSheet } from "@/components/scoring/HeadJudgeJudgeSheet";
import { HeadJudgeLogList } from "@/components/scoring/HeadJudgeLogList";

// Painel Head Judge (Modo Supervisão), versão desktop — aside fixo à
// direita da tela de lançar notas, só visível quando
// `ScoringSheet.isHeadJudge` é true (ver EventLiveScoringDesktopView).
// Fechar (X) desmonta o painel inteiro e volta ao Modo Julgamento — a
// tela por baixo nunca é afetada, é só um overlay condicional.
interface HeadJudgePanelProps {
  eventId: string;
  scheduleEntryId: string;
  onClose: () => void;
}

export function HeadJudgePanel({ eventId, scheduleEntryId, onClose }: HeadJudgePanelProps) {
  const {
    activeTab,
    setActiveTab,
    roster,
    rosterLoading,
    selectedJudgeId,
    selectJudge,
    closeJudgeSheet,
    log,
    logLoading,
  } = useHeadJudgePanelState(eventId, scheduleEntryId);

  return (
    <motion.aside
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex h-svh w-[380px] shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold tracking-wide text-foreground">
          <ShieldCheck className="size-4 text-primary" />
          HEAD JUDGE
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel"
          className="flex size-8 items-center justify-center rounded-md text-foreground/70 hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>

      {selectedJudgeId ? (
        <HeadJudgeJudgeSheet
          eventId={eventId}
          scheduleEntryId={scheduleEntryId}
          judgeParticipationId={selectedJudgeId}
          onBack={closeJudgeSheet}
        />
      ) : (
        <>
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab("roster")}
              className={cn(
                "flex-1 border-b-2 px-4 py-2.5 text-sm font-medium",
                activeTab === "roster" ? "border-primary text-primary" : "border-transparent text-muted-foreground",
              )}
            >
              Avaliações
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("log")}
              className={cn(
                "flex-1 border-b-2 px-4 py-2.5 text-sm font-medium",
                activeTab === "log" ? "border-primary text-primary" : "border-transparent text-muted-foreground",
              )}
            >
              Logs
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === "roster" ? (
              <HeadJudgeRosterList roster={roster} loading={rosterLoading} onSelectJudge={selectJudge} />
            ) : (
              <HeadJudgeLogList log={log} loading={logLoading} />
            )}
          </div>
        </>
      )}
    </motion.aside>
  );
}

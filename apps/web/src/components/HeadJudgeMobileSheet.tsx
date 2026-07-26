import { motion } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeadJudgePanelState } from "@/lib/useHeadJudgePanelState";
import { HeadJudgeRosterList } from "@/components/scoring/HeadJudgeRosterList";
import { HeadJudgeJudgeSheet } from "@/components/scoring/HeadJudgeJudgeSheet";
import { HeadJudgeLogList } from "@/components/scoring/HeadJudgeLogList";

// Painel Head Judge (Modo Supervisão), versão mobile — tela cheia
// empilhada (Equipe/jurados → folha do jurado, com botão voltar) em
// vez do aside lateral do desktop (telas operacionais deste projeto
// são mobile-first, o jurado está no evento com o celular). Mesmo
// estado/dados de HeadJudgePanel (useHeadJudgePanelState), só a casca
// muda. Fechar (X) desmonta o painel inteiro e volta ao Modo
// Julgamento.
interface HeadJudgeMobileSheetProps {
  eventId: string;
  scheduleEntryId: string;
  onClose: () => void;
}

export function HeadJudgeMobileSheet({ eventId, scheduleEntryId, onClose }: HeadJudgeMobileSheetProps) {
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
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="fixed inset-0 z-30 flex h-svh flex-col bg-background lg:hidden">
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold tracking-wide text-foreground">
          <ShieldCheck className="size-4 text-primary" />
          HEAD JUDGE
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel"
          className="flex size-9 items-center justify-center rounded-md text-foreground/70 hover:bg-muted"
        >
          <X className="size-5" />
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
          <div className="flex border-b border-border bg-card">
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
    </motion.div>
  );
}

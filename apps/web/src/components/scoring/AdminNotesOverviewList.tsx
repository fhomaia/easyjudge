import { useState } from "react";
import { ChevronRight, Download, Loader2 } from "lucide-react";
import { formatPercent, formatPoints } from "@/lib/formatNumber";
import { downloadPresentationDetailPdf } from "@/lib/presentationDetailExport";
import { cn } from "@/lib/utils";
import { adminScoringApi, type AdminOverviewEntry } from "@/api/client";

// Lista de apresentações 100% pontuadas (as incompletas ficam ocultas
// — decisão do usuário) na visão do admin/assessor da tela de Notas —
// com UMA exceção: apresentação com desistência sinalizada também
// entra aqui (mesmo nunca tendo sido pontuada), sempre inativa e com a
// badge "Desistência" (ver ScoringService.getAdminOverview/
// buildTeamScopedOverview).
//
// Reusada também pelas visões de Programa/Atleta (`EventLiveTeamNotesPage`,
// `AthleteNotesOverview`), que NÃO passam `eventId` — o botão de baixar
// súmula em PDF só existe pro admin/assessor (pedido explícito do
// usuário), e depende de `adminScoringApi.getDetail` especificamente
// (as outras visões usam `teamScoringApi`/`athleteScoringApi`, rotas
// diferentes — chamar a rota de admin pra elas daria 403). `eventId`
// opcional é o gate: só quem passa ganha a coluna de download.
interface AdminNotesOverviewListProps {
  eventId?: string;
  entries: AdminOverviewEntry[];
  onSelect: (scheduleEntryId: string) => void;
}

export function AdminNotesOverviewList({ eventId, entries, onSelect }: AdminNotesOverviewListProps) {
  // Download individual (ver AdminNotesOverview pro "baixar todas") —
  // busca o detalhe completo sob demanda (a listagem não carrega
  // grupos/critérios) e monta o PDF na hora, mesmo padrão de
  // ScoringTemplateCard (ícone ao lado do item, sem abrir o detalhe).
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(eventId: string, entry: AdminOverviewEntry) {
    setDownloadingId(entry.scheduleEntryId);
    try {
      const detail = await adminScoringApi.getDetail(eventId, entry.scheduleEntryId);
      downloadPresentationDetailPdf(detail);
    } catch (err) {
      console.error("Não foi possível gerar a súmula.", err);
    } finally {
      setDownloadingId(null);
    }
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nenhuma súmula disponível ainda.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        // Div (não button) — precisa acomodar o botão de download COMO
        // FILHO, e um <button> dentro de outro <button> é HTML inválido
        // (mesmo problema/mesma correção já usada em outro card clicável
        // do projeto, ver ScoringTemplateCard.tsx). O clique na linha
        // continua abrindo o detalhe; o botão de download para a
        // propagação pra não disparar os dois.
        <div
          key={entry.scheduleEntryId}
          onClick={() => !entry.withdrawn && onSelect(entry.scheduleEntryId)}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3",
            entry.withdrawn
              ? "cursor-default opacity-60"
              : "cursor-pointer hover:border-primary/40 hover:bg-primary/5",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{entry.teamName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {entry.categoryName} · {entry.resourceName}
            </p>
          </div>
          {!entry.withdrawn && eventId && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleDownload(eventId, entry);
              }}
              disabled={downloadingId === entry.scheduleEntryId}
              aria-label={`Baixar súmula de ${entry.teamName}`}
              title="Baixar súmula em PDF"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {downloadingId === entry.scheduleEntryId ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
            </button>
          )}
          {!entry.withdrawn && (
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-foreground">{formatPoints(entry.finalResult)} pts</p>
              <p className="text-xs text-muted-foreground">{formatPercent(entry.percentage)}</p>
            </div>
          )}
          {entry.withdrawn && (
            <span className="shrink-0 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">
              Desistência
            </span>
          )}
          {entry.contestationRequested && (
            <span className="shrink-0 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">
              Contestação
            </span>
          )}
          {!entry.withdrawn && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}

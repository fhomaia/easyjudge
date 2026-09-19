import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DocumentViewerDialog } from "@/components/DocumentViewerDialog";
import { regulationApi, type RegulationDocument } from "@/api/client";
import { cn } from "@/lib/utils";

const BUTTON_CLASS =
  "flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40";

// Botão com ícone de documento: escolhe um dos documentos do evento
// (regulamento, regras de segurança, código de conduta, adicionais) e
// abre na própria tela. Com um único documento, abre direto. Pega o
// evento da rota (`/events/:id/...`).
export function EventDocumentsButton({ className }: { className?: string }) {
  const { id } = useParams();
  const [documents, setDocuments] = useState<RegulationDocument[]>([]);
  const [viewing, setViewing] = useState<RegulationDocument | null>(null);

  useEffect(() => {
    if (!id) return;
    regulationApi
      .get(id)
      .then((regulation) => setDocuments(regulation.documents))
      .catch(() => setDocuments([]));
  }, [id]);

  const empty = documents.length === 0;
  const title = empty ? "Nenhum documento enviado ainda" : "Documentos do evento";

  return (
    <>
      {documents.length === 1 ? (
        <button
          type="button"
          onClick={() => setViewing(documents[0])}
          aria-label={`Ver ${documents[0].name}`}
          title={documents[0].name}
          className={cn(BUTTON_CLASS, className)}
        >
          <FileText className="size-4" />
        </button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                disabled={empty}
                title={title}
                aria-label="Documentos do evento"
                className={cn(BUTTON_CLASS, className)}
              />
            }
          >
            <FileText className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {documents.map((doc) => (
              <DropdownMenuItem key={doc.id} onClick={() => setViewing(doc)}>
                <FileText data-icon="inline-start" />
                <span className="truncate">{doc.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <DocumentViewerDialog document={viewing} onOpenChange={(open) => !open && setViewing(null)} />
    </>
  );
}

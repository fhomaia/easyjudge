import { useState } from "react";
import { FileText } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DocumentViewerDialog } from "@/components/DocumentViewerDialog";
import type { RegulationDocument } from "@/api/client";
import { cn } from "@/lib/utils";

// Botão "Regulamento" com a lista dos documentos do evento (etapa
// Regulamento do Setup); cada um abre na própria tela. Mesmo padrão do
// EventDocumentsButton do evento ao vivo, mas recebe os documentos prontos:
// as telas de inscrição do programa e do atleta não usam a rota de
// regulamento (exige EventMember). Sem documentos, nada aparece.
export function RegulationDocumentsMenu({
  documents,
  className,
}: {
  documents: RegulationDocument[];
  className?: string;
}) {
  const [viewing, setViewing] = useState<RegulationDocument | null>(null);
  if (documents.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted",
                className,
              )}
            />
          }
        >
          <FileText className="size-4 text-muted-foreground" />
          Regulamento
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {documents.map((doc) => (
            <DropdownMenuItem key={doc.id} onClick={() => setViewing(doc)}>
              <FileText data-icon="inline-start" />
              <span className="truncate">{doc.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DocumentViewerDialog document={viewing} onOpenChange={(open) => !open && setViewing(null)} />
    </>
  );
}

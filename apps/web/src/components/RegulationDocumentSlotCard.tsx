import { useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { formatFileSize } from "@/lib/formatFileSize";
import { cn } from "@/lib/utils";
import type { RegulationDocument, RegulationDocumentKind } from "@/api/client";

interface RegulationDocumentSlotCardProps {
  kind: RegulationDocumentKind;
  label: string;
  required?: boolean;
  document?: RegulationDocument;
  onUpload: (kind: RegulationDocumentKind, file: File) => Promise<void>;
  onRequestDelete: (document: RegulationDocument) => void;
}

export function RegulationDocumentSlotCard({
  kind,
  label,
  required,
  document,
  onUpload,
  onRequestDelete,
}: RegulationDocumentSlotCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Nome do arquivo em envio (null = nada em andamento).
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const uploading = uploadingName !== null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingName(file.name);
    try {
      await onUpload(kind, file);
    } finally {
      setUploadingName(null);
    }
  }

  return (
    <div
      aria-busy={uploading}
      className={cn(
        "group flex min-h-28 flex-col justify-between rounded-lg border border-border/60 bg-card p-4 transition-colors",
        uploading && "border-primary/60 bg-primary/[0.05]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </p>
        {document && (
          <button
            type="button"
            onClick={() => onRequestDelete(document)}
            aria-label={`Remover ${label}`}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={handleFileChange}
      />

      {uploading ? (
        // Estado próprio, bem visível (antes era só o texto do botão
        // desabilitado, que o navegador apaga). Cobre também a troca de
        // um documento já enviado, que antes não mostrava nada.
        <div
          role="status"
          className="mt-3 flex items-center gap-2 text-sm font-medium text-primary"
        >
          <Loader2 className="size-5 shrink-0 animate-spin" />
          <span className="min-w-0">
            <span className="block">Enviando...</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {uploadingName}
            </span>
          </span>
        </div>
      ) : document ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 flex items-center gap-2 rounded-md text-left"
        >
          <FileText className="size-5 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block truncate text-sm text-foreground">{document.name}</span>
            <span className="block text-xs text-muted-foreground">
              {formatFileSize(document.sizeBytes)}
            </span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.04] hover:text-primary"
        >
          <Upload className="size-4 shrink-0" />
          Clique para enviar
        </button>
      )}
    </div>
  );
}

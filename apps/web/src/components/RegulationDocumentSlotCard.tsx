import { useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { formatFileSize } from "@/lib/formatFileSize";
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
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(kind, file);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="group flex min-h-28 flex-col justify-between rounded-lg border border-border/60 bg-card p-4">
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

      {document ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
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
          disabled={uploading}
          className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.04] hover:text-primary"
        >
          <Upload className="size-4 shrink-0" />
          {uploading ? "Enviando..." : "Clique para enviar"}
        </button>
      )}
    </div>
  );
}

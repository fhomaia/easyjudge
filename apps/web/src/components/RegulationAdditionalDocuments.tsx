import { useRef, useState, type FormEvent } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/formatFileSize";
import type { RegulationDocument } from "@/api/client";

interface RegulationAdditionalDocumentsProps {
  documents: RegulationDocument[];
  onUpload: (file: File, name: string) => Promise<void>;
  onRequestDelete: (document: RegulationDocument) => void;
}

export function RegulationAdditionalDocuments({
  documents,
  onUpload,
  onRequestDelete,
}: RegulationAdditionalDocumentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPendingFile(file);
    setTitle(file.name);
  }

  function handleDialogOpenChange(open: boolean) {
    if (!open) {
      setPendingFile(null);
      setTitle("");
    }
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (!pendingFile) return;
    setUploading(true);
    try {
      await onUpload(pendingFile, title.trim() || pendingFile.name);
      setPendingFile(null);
      setTitle("");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Documentos adicionais</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-md border border-primary/40 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Plus className="size-3.5" />
          Adicionar documento
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {documents.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">Nenhum documento adicional enviado.</p>
      ) : (
        <div className="mt-1 flex flex-col gap-1.5">
          {documents.map((document) => (
            <div
              key={document.id}
              className="group flex items-center gap-2 rounded-md border border-border/60 px-3 py-2"
            >
              <FileText className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{document.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(document.sizeBytes)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRequestDelete(document)}
                aria-label={`Remover ${document.name}`}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={pendingFile !== null} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="gap-6 p-8 sm:max-w-md">
          <div className="grid gap-1.5">
            <DialogTitle className="text-xl font-medium">Adicionar documento</DialogTitle>
            <DialogDescription>
              Dê um título para identificar este documento na lista.
            </DialogDescription>
          </div>

          <form onSubmit={handleConfirm} className="grid gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="additional-document-title">Título do documento</Label>
              <Input
                id="additional-document-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <Button type="submit" disabled={uploading} className="w-full">
              {uploading ? "Enviando..." : "Enviar documento"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

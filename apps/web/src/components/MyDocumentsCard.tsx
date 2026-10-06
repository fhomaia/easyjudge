import { useEffect, useRef, useState } from "react";
import { FileText, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormError } from "@/components/FormError";
import { ApiError, userDocumentsApi, type UserDocumentView } from "@/api/client";

const ACCEPTED_FILES = ".pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

// "Meus documentos" no perfil (2026-10-06): biblioteca da conta, usada pra
// reenviar em outros eventos. Excluir daqui não tira dos eventos em que o
// documento já foi enviado.
export function MyDocumentsCard() {
  const [docs, setDocs] = useState<UserDocumentView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<UserDocumentView | null>(null);

  useEffect(() => {
    userDocumentsApi
      .list()
      .then(setDocs)
      .catch(() => setDocs([]));
  }, []);

  async function open(doc: UserDocumentView) {
    setError(null);
    try {
      await userDocumentsApi.openFile(doc.id, doc.file.fileName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível abrir o arquivo.");
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Meus documentos</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Documentos que você enviou nas inscrições, guardados para usar em outros eventos. Só você
            vê esta lista.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />
          Adicionar
        </Button>
      </div>

      <div className="mt-4 grid gap-2">
        {docs === null ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum documento guardado.</p>
        ) : (
          docs.map((doc) => (
            <div
              key={doc.id}
              className="flex min-w-0 items-center gap-3 rounded-md border border-border/60 px-3 py-2"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <button
                type="button"
                onClick={() => void open(doc)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm text-foreground hover:underline">
                  {doc.file.fileName}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {doc.label ?? "Documento"} · {formatSize(doc.file.size)} ·{" "}
                  {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Excluir ${doc.file.fileName}`}
                onClick={() => setRemoveTarget(doc)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
        <FormError message={error} />
      </div>

      {addOpen && (
        <AddDocumentDialog
          onClose={() => setAddOpen(false)}
          onAdded={(added) => {
            setDocs([...added, ...(docs ?? [])]);
            setAddOpen(false);
          }}
        />
      )}
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(next) => !next && setRemoveTarget(null)}
        title="Excluir documento"
        description={`Excluir "${removeTarget?.file.fileName ?? ""}" da sua biblioteca? Ele continua nos eventos em que você já enviou.`}
        confirmLabel="Excluir"
        confirmingLabel="Excluindo..."
        onConfirm={async () => {
          if (!removeTarget) return;
          await userDocumentsApi.remove(removeTarget.id);
          setDocs((docs ?? []).filter((d) => d.id !== removeTarget.id));
          setRemoveTarget(null);
        }}
      />
    </div>
  );
}

function AddDocumentDialog({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (docs: UserDocumentView[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      onAdded(await userDocumentsApi.upload(files, label.trim() || null));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto p-6 sm:max-w-lg sm:p-8">
        <div className="grid gap-1">
          <DialogTitle>Adicionar documento</DialogTitle>
          <DialogDescription>
            PDF ou foto, até 10 MB cada e no máximo 4 arquivos.
          </DialogDescription>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="my-document-label">Nome (opcional)</Label>
          <Input
            id="my-document-label"
            value={label}
            maxLength={120}
            placeholder="Ex.: RG, comprovante de matrícula"
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILES}
          className="hidden"
          onChange={(e) => {
            setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 4));
            e.target.value = "";
          }}
        />
        {files.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-sm"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <button
              type="button"
              aria-label={`Tirar ${file.name}`}
              onClick={() => setFiles(files.filter((_, i) => i !== index))}
              className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        <Button
          variant="outline"
          className="w-full sm:w-auto sm:justify-self-start"
          disabled={files.length >= 4}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" />
          Escolher arquivo
        </Button>
        <FormError message={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving || files.length === 0}>
            {saving ? "Enviando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

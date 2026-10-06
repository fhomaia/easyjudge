import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Flag, Lock, Pencil, Trash2, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/DatePicker";
import { FormError } from "@/components/FormError";
import { formatCpf, formatPhone } from "@/lib/masks";
import { cn } from "@/lib/utils";
import {
  ApiError,
  athleteRequirementsApi,
  userDocumentsApi,
  type AthleteRequirementItem,
  type AthleteRequirementsView,
  type UserDocumentView,
} from "@/api/client";

// Como o painel fala com a API: pela tela do programa/produtor (padrão) ou
// pelo "Inscreva-se aqui" do atleta (que também usa a biblioteca dele).
export interface RequirementsAdapter {
  list: () => Promise<AthleteRequirementsView>;
  set: (requirementId: string, value: string | null) => Promise<AthleteRequirementsView>;
  uploadDocument: (
    requirementId: string,
    files: File[],
    libraryDocumentIds: string[],
  ) => Promise<AthleteRequirementsView>;
  removeDocument: (requirementId: string) => Promise<AthleteRequirementsView>;
  openFile: (requirementId: string, index: number, fileName: string) => Promise<void>;
  // Só o produtor.
  contest?: (requirementId: string, reason: string) => Promise<AthleteRequirementsView>;
  // Só o atleta: escolher documentos já enviados antes.
  useLibrary?: boolean;
}

export function programRequirementsAdapter(
  eventId: string,
  programId: string,
  athleteId: string,
  { canContest = false } = {},
): RequirementsAdapter {
  return {
    list: () => athleteRequirementsApi.list(eventId, programId, athleteId),
    set: (requirementId, value) =>
      athleteRequirementsApi.set(eventId, programId, athleteId, requirementId, value),
    uploadDocument: (requirementId, files) =>
      athleteRequirementsApi.uploadDocument(eventId, programId, athleteId, requirementId, files),
    removeDocument: (requirementId) =>
      athleteRequirementsApi.removeDocument(eventId, programId, athleteId, requirementId),
    openFile: (requirementId, index, fileName) =>
      athleteRequirementsApi.openFile(eventId, programId, athleteId, requirementId, index, fileName),
    contest: canContest
      ? (requirementId, reason) =>
          athleteRequirementsApi.contestDocument(eventId, programId, athleteId, requirementId, reason)
      : undefined,
  };
}

const ACCEPTED_FILES = ".pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";
const MAX_FILES = 4;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

const brDate = (iso: string) => iso.split("-").reverse().join("/");

function displayValue(item: AthleteRequirementItem): string | null {
  const { value, requirement } = item;
  if (!value) return null;
  if (requirement.kind === "date") return brDate(value);
  if (requirement.preset === "cpf") return formatCpf(value);
  if (requirement.preset === "phone") return formatPhone(value);
  return value;
}

// Dados pessoais de um atleta do evento: nome e email (fixos) e os dados e
// documentos pedidos na inscrição (aba Configurações), na ordem
// configurada, com o valor e edição no lugar. Usado na tela do programa
// (produtor, que também contesta documentos), na ficha de inscrição (conta
// Programa) e no "Inscreva-se aqui" do atleta (`adapter`).
export function AthleteRequirementsPanel({
  eventId,
  programId,
  athleteId,
  adapter: customAdapter,
  initialView,
  canContest = false,
  onChanged,
  readOnly = false,
}: {
  eventId?: string;
  programId?: string;
  athleteId?: string;
  adapter?: RequirementsAdapter;
  initialView?: AthleteRequirementsView;
  // Produtor: pode contestar documentos.
  canContest?: boolean;
  // Ficha travada: dados só consulta (documentos seguem o que a API diz).
  readOnly?: boolean;
  // Data de nascimento/CPF ficam no atleta: quem mostra a idade recarrega.
  onChanged?: (view: AthleteRequirementsView) => void;
}) {
  const adapter = useMemo(
    () =>
      customAdapter ??
      programRequirementsAdapter(eventId as string, programId as string, athleteId as string, {
        canContest,
      }),
    [customAdapter, eventId, programId, athleteId, canContest],
  );
  const [view, setView] = useState<AthleteRequirementsView | null>(initialView ?? null);
  const [error, setError] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<AthleteRequirementItem | null>(null);
  const [contestTarget, setContestTarget] = useState<AthleteRequirementItem | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AthleteRequirementItem | null>(null);

  const load = useCallback(() => {
    adapter
      .list()
      .then(setView)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar os dados."),
      );
  }, [adapter]);

  const skipFirstLoad = useRef(!!initialView);
  useEffect(() => {
    if (skipFirstLoad.current) {
      skipFirstLoad.current = false;
      return;
    }
    setView(null);
    load();
  }, [load]);

  function applyView(next: AthleteRequirementsView) {
    setView(next);
    onChanged?.(next);
  }

  if (!view) return error ? <FormError message={error} /> : null;

  // Itens que valem pras categorias do atleta primeiro; os outros, no fim.
  const applicable = view.items.filter((i) => i.applies);
  const others = view.items.filter((i) => !i.applies);

  return (
    <div className="grid gap-3 text-sm">
      <div className="divide-y divide-border/60 rounded-lg border border-border/60">
        <FieldRow label="Nome completo">
          <span className="font-medium break-words text-foreground">{view.name}</span>
        </FieldRow>
        <FieldRow label="Email">
          <span className="font-medium break-all text-foreground">{view.email}</span>
        </FieldRow>
        {applicable.map((item) =>
          item.requirement.kind === "document" ? (
            <DocumentField
              key={item.requirement.id}
              item={item}
              editable={item.documentEditable}
              canRemove={item.documentEditable && !view.athleteLocked}
              canContest={!!adapter.contest}
              onUpload={() => setUploadTarget(item)}
              onRemove={() => setRemoveTarget(item)}
              onContest={() => setContestTarget(item)}
              onOpen={(index, fileName) =>
                adapter.openFile(item.requirement.id as string, index, fileName)
              }
            />
          ) : (
            <RequirementField
              key={item.requirement.id}
              item={item}
              readOnly={readOnly || !view.dataEditable}
              onSave={async (value) => {
                const next = await adapter.set(item.requirement.id as string, value);
                applyView(next);
              }}
            />
          ),
        )}
      </div>
      {uploadTarget && (
        <DocumentUploadDialog
          item={uploadTarget}
          useLibrary={!!adapter.useLibrary}
          onClose={() => setUploadTarget(null)}
          onSubmit={async (files, libraryIds) => {
            const next = await adapter.uploadDocument(
              uploadTarget.requirement.id as string,
              files,
              libraryIds,
            );
            applyView(next);
            setUploadTarget(null);
          }}
        />
      )}
      {contestTarget && adapter.contest && (
        <ContestDialog
          item={contestTarget}
          onClose={() => setContestTarget(null)}
          onSubmit={async (reason) => {
            const next = await adapter.contest!(contestTarget.requirement.id as string, reason);
            applyView(next);
            setContestTarget(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remover documento"
        description={`Tirar "${removeTarget?.requirement.label ?? ""}" desta inscrição? Os arquivos continuam na biblioteca de quem enviou, se for o atleta.`}
        confirmLabel="Remover"
        confirmingLabel="Removendo..."
        onConfirm={async () => {
          if (!removeTarget) return;
          const next = await adapter.removeDocument(removeTarget.requirement.id as string);
          applyView(next);
          setRemoveTarget(null);
        }}
      />
      {others.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Pedidos só em algumas categorias:{" "}
          {others.map((i) => i.requirement.label).join(", ")}.
        </p>
      )}
    </div>
  );
}

// Uma linha: rótulo (pequeno, cinza) e conteúdo. Lado a lado a partir de
// sm; empilhado no celular.
function FieldRow({
  label,
  required = false,
  status,
  children,
}: {
  label: string;
  required?: boolean;
  // Selo de situação (Pendente, Enviado...), junto do rótulo.
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 px-3 py-2.5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-center sm:gap-3">
      <dt className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </span>
        {status}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "danger" | "muted" | "success";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "danger"
          ? "bg-destructive/10 text-destructive"
          : tone === "success"
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function DocumentField({
  item,
  editable,
  canRemove,
  canContest,
  onUpload,
  onRemove,
  onContest,
  onOpen,
}: {
  item: AthleteRequirementItem;
  editable: boolean;
  canRemove: boolean;
  canContest: boolean;
  onUpload: () => void;
  onRemove: () => void;
  onContest: () => void;
  onOpen: (index: number, fileName: string) => Promise<void>;
}) {
  const { requirement, document } = item;
  const [openError, setOpenError] = useState<string | null>(null);
  const contested = document?.status === "contested";

  async function open(index: number, fileName: string) {
    setOpenError(null);
    try {
      await onOpen(index, fileName);
    } catch (err) {
      setOpenError(err instanceof ApiError ? err.message : "Não foi possível abrir o arquivo.");
    }
  }

  const status = document ? (
    contested ? (
      <StatusBadge tone="danger">Contestado</StatusBadge>
    ) : (
      <StatusBadge tone="success">Enviado</StatusBadge>
    )
  ) : requirement.required ? (
    <StatusBadge tone="danger">Pendente</StatusBadge>
  ) : (
    <StatusBadge tone="muted">Não enviado</StatusBadge>
  );

  return (
    <FieldRow label={requirement.label} required={requirement.required} status={status}>
      <div className="grid min-w-0 gap-2">
        {requirement.description && (
          <p className="text-xs text-muted-foreground">{requirement.description}</p>
        )}
        {document && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {document.files.map((file, index) => (
                <button
                  key={file.key}
                  type="button"
                  onClick={() => void open(index, file.fileName)}
                  title={`${file.fileName} (${formatSize(file.size)})`}
                  className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
                >
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{file.fileName}</span>
                </button>
              ))}
            </div>
            {contested && document.contestReason && (
              <p className="rounded-md bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
                Motivo: {document.contestReason}
              </p>
            )}
          </>
        )}
        <FormError message={openError} />
        {(editable || (canContest && document && !contested)) && (
          <div className="flex flex-wrap gap-2">
            {editable && (
              <Button size="sm" variant="outline" onClick={onUpload}>
                <Upload className="size-3.5" />
                {document ? (contested ? "Enviar de novo" : "Trocar") : "Enviar"}
              </Button>
            )}
            {canRemove && document && (
              <Button size="sm" variant="ghost" onClick={onRemove} aria-label={`Remover ${requirement.label}`}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
            {canContest && document && !contested && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={onContest}>
                <Flag className="size-3.5" />
                Contestar
              </Button>
            )}
          </div>
        )}
      </div>
    </FieldRow>
  );
}

function DocumentUploadDialog({
  item,
  useLibrary,
  onClose,
  onSubmit,
}: {
  item: AthleteRequirementItem;
  useLibrary: boolean;
  onClose: () => void;
  onSubmit: (files: File[], libraryIds: string[]) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [library, setLibrary] = useState<UserDocumentView[] | null>(useLibrary ? null : []);
  const [libraryIds, setLibraryIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!useLibrary) return;
    userDocumentsApi
      .list()
      .then(setLibrary)
      .catch(() => setLibrary([]));
  }, [useLibrary]);

  const total = files.length + libraryIds.size;

  function addFiles(list: FileList | null) {
    setError(null);
    const picked = Array.from(list ?? []);
    const tooBig = picked.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setError(`"${tooBig.name}" passa de 10 MB.`);
      return;
    }
    const next = [...files, ...picked];
    if (next.length + libraryIds.size > MAX_FILES) {
      setError(`No máximo ${MAX_FILES} arquivos por documento.`);
      return;
    }
    setFiles(next);
  }

  function toggleLibrary(id: string, checked: boolean) {
    setError(null);
    const next = new Set(libraryIds);
    if (checked) {
      if (files.length + next.size >= MAX_FILES) {
        setError(`No máximo ${MAX_FILES} arquivos por documento.`);
        return;
      }
      next.add(id);
    } else {
      next.delete(id);
    }
    setLibraryIds(next);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(files, [...libraryIds]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto p-6 sm:max-w-lg sm:p-8">
        <div className="grid gap-1">
          <DialogTitle>{item.requirement.label}</DialogTitle>
          <DialogDescription>
            {item.requirement.description ? `${item.requirement.description} ` : ""}
            PDF ou foto, até 10 MB cada e no máximo {MAX_FILES} arquivos (frente e verso podem ir
            como dois arquivos).
          </DialogDescription>
        </div>

        {useLibrary && (
          <div className="grid gap-2">
            <p className="text-sm font-medium">Da sua biblioteca</p>
            {library === null ? (
              <p className="text-xs text-muted-foreground">Carregando...</p>
            ) : library.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum documento salvo ainda. O que você enviar agora fica guardado para os próximos
                eventos.
              </p>
            ) : (
              <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-border/60 p-2">
                {library.map((doc) => (
                  <label key={doc.id} className="flex min-w-0 cursor-pointer items-center gap-3 rounded-md px-1 py-1 text-sm">
                    <Checkbox
                      checked={libraryIds.has(doc.id)}
                      onCheckedChange={(value) => toggleLibrary(doc.id, value === true)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{doc.file.fileName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {doc.label ?? "Documento"} · {formatSize(doc.file.size)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-2">
          {useLibrary && <p className="text-sm font-medium">Arquivo novo</p>}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILES}
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatSize(file.size)}</span>
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
            disabled={total >= MAX_FILES}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            Escolher arquivo
          </Button>
        </div>

        <FormError message={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving || total === 0}>
            {saving ? "Enviando..." : "Enviar documento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContestDialog({
  item,
  onClose,
  onSubmit,
}: {
  item: AthleteRequirementItem;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível contestar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto p-6 sm:max-w-lg sm:p-8">
        <div className="grid gap-1">
          <DialogTitle>Contestar {item.requirement.label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            O programa e o atleta recebem o motivo e podem enviar de novo até o prazo de inscrição.
          </DialogDescription>
        </div>
        <Textarea
          autoFocus
          value={reason}
          maxLength={1000}
          rows={4}
          placeholder="Ex.: foto ilegível, documento vencido, falta o verso."
          onChange={(e) => setReason(e.target.value)}
        />
        <FormError message={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={saving || !reason.trim()}>
            {saving ? "Enviando..." : "Contestar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RequirementField({
  item,
  readOnly,
  onSave,
}: {
  item: AthleteRequirementItem;
  readOnly: boolean;
  onSave: (value: string | null) => Promise<void>;
}) {
  const { requirement } = item;
  const shown = displayValue(item);
  const canEdit = !readOnly && !item.readOnly;
  const [editing, setEditing] = useState(false);
  const status =
    requirement.required && !item.value ? <StatusBadge tone="danger">Pendente</StatusBadge> : null;

  return (
    <FieldRow label={requirement.label} required={requirement.required} status={status}>
      {editing && canEdit ? (
        <InlineEditor item={item} onSave={onSave} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-medium break-words text-foreground">{shown ?? "—"}</span>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Editar ${requirement.label}`}
              className="-my-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
          {item.readOnly && (
            // Só o cadeado; o motivo fica na dica (e pro leitor de tela).
            <span
              title="Vem da conta do atleta: não dá para alterar aqui."
              aria-label="Vem da conta do atleta"
              className="text-muted-foreground"
            >
              <Lock className="size-3.5" />
            </span>
          )}
        </div>
      )}
    </FieldRow>
  );
}

// Campo aberto pelo lápis, com Salvar/Cancelar (Enter salva, Esc
// cancela). Tamanho compacto: o campo padrão (h-12) ficava grande demais
// dentro da lista de dados.
function InlineEditor({
  item,
  onSave,
  onDone,
}: {
  item: AthleteRequirementItem;
  onSave: (value: string | null) => Promise<void>;
  onDone: () => void;
}) {
  const { requirement } = item;
  const format = (v: string) =>
    requirement.preset === "cpf" ? formatCpf(v) : requirement.preset === "phone" ? formatPhone(v) : v;
  const saved = item.value ? format(item.value) : "";
  const [value, setValue] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (value.trim() === saved.trim()) {
      onDone();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(value.trim() || null);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const masked = requirement.preset === "cpf" || requirement.preset === "phone";

  return (
    <div className="grid gap-2">
      <div className="max-w-sm">
        {requirement.kind === "select" ? (
          <Select value={value || null} onValueChange={(v) => setValue((v as string) ?? "")}>
            <SelectTrigger className="h-9 w-full px-3 text-sm data-[size=default]:h-9">
              <SelectValue>{(v: string | null) => v || "Selecione"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {requirement.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : requirement.kind === "date" ? (
          <DatePicker
            size="sm"
            value={value}
            onChange={setValue}
            captionLayout="dropdown"
            startMonth={new Date(new Date().getFullYear() - 100, 0, 1)}
            maxDate={requirement.preset === "birth_date" ? new Date() : undefined}
          />
        ) : (
          <Input
            autoFocus
            value={value}
            aria-label={requirement.label}
            maxLength={masked ? 20 : 300}
            inputMode={masked ? "numeric" : undefined}
            placeholder={
              requirement.preset === "cpf"
                ? "000.000.000-00"
                : requirement.preset === "phone"
                  ? "(00) 00000-0000"
                  : undefined
            }
            onChange={(e) => setValue(format(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") onDone();
            }}
            className="h-9 px-3 text-sm md:text-sm"
          />
        )}
      </div>
      <FormError message={error} />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

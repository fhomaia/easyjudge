import { useCallback, useEffect, useState } from "react";
import { Lock, Pencil } from "lucide-react";
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
  type AthleteRequirementItem,
  type AthleteRequirementsView,
} from "@/api/client";

const brDate = (iso: string) => iso.split("-").reverse().join("/");

function displayValue(item: AthleteRequirementItem): string | null {
  const { value, requirement } = item;
  if (!value) return null;
  if (requirement.kind === "date") return brDate(value);
  if (requirement.preset === "cpf") return formatCpf(value);
  if (requirement.preset === "phone") return formatPhone(value);
  return value;
}

// Dados pessoais de um atleta do evento: nome e email (fixos) e os dados
// pedidos na inscrição (aba Configurações), na ordem configurada, com o valor e
// edição no lugar. Usado na tela do programa (produtor) e na ficha de
// inscrição (conta Programa). Documentos ainda não são enviados por aqui.
export function AthleteRequirementsPanel({
  eventId,
  programId,
  athleteId,
  onChanged,
  readOnly = false,
}: {
  eventId: string;
  programId: string;
  athleteId: string;
  // Ficha travada: só consulta.
  readOnly?: boolean;
  // Data de nascimento/CPF ficam no atleta: quem mostra a idade recarrega.
  onChanged?: () => void;
}) {
  const [view, setView] = useState<AthleteRequirementsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(() => {
    athleteRequirementsApi
      .list(eventId, programId, athleteId)
      .then(setView)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar os dados."),
      );
  }, [eventId, programId, athleteId]);

  useEffect(() => {
    setView(null);
    setEditingId(null);
    load();
  }, [load]);

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
        {applicable.map((item) => (
          <RequirementField
            key={item.requirement.id}
            item={item}
            readOnly={readOnly}
            editing={editingId === item.requirement.id}
            onEdit={() => setEditingId(item.requirement.id)}
            onCancel={() => setEditingId(null)}
            onSave={async (value) => {
              const next = await athleteRequirementsApi.set(
                eventId,
                programId,
                athleteId,
                item.requirement.id as string,
                value,
              );
              setView(next);
              setEditingId(null);
              onChanged?.();
            }}
          />
        ))}
      </div>
      {others.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Não se aplicam às categorias deste atleta:{" "}
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
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-start sm:gap-3">
      <dt className="pt-0.5 text-xs text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function StatusBadge({ tone, children }: { tone: "danger" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function RequirementField({
  item,
  readOnly,
  editing,
  onEdit,
  onCancel,
  onSave,
}: {
  item: AthleteRequirementItem;
  readOnly: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (value: string | null) => Promise<void>;
}) {
  const { requirement } = item;
  const shown = displayValue(item);
  const isDocument = requirement.kind === "document";
  const canEdit = !readOnly && !item.readOnly && !isDocument;

  return (
    <FieldRow label={requirement.label} required={requirement.required}>
      {editing ? (
        <ValueEditor item={item} onCancel={onCancel} onSave={onSave} />
      ) : (
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {isDocument ? (
              <StatusBadge tone="muted">Envio de documentos em breve</StatusBadge>
            ) : shown ? (
              <span className="font-medium break-words text-foreground">{shown}</span>
            ) : requirement.required ? (
              <StatusBadge tone="danger">Pendente</StatusBadge>
            ) : (
              <StatusBadge tone="muted">Não informado</StatusBadge>
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
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Editar ${requirement.label}`}
              className="-my-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </FieldRow>
  );
}

function ValueEditor({
  item,
  onCancel,
  onSave,
}: {
  item: AthleteRequirementItem;
  onCancel: () => void;
  onSave: (value: string | null) => Promise<void>;
}) {
  const { requirement } = item;
  const format = (v: string) =>
    requirement.preset === "cpf" ? formatCpf(v) : requirement.preset === "phone" ? formatPhone(v) : v;
  const [value, setValue] = useState(item.value ? format(item.value) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave(value.trim() || null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-2">
      {requirement.kind === "select" ? (
        <Select value={value || null} onValueChange={(v) => setValue((v as string) ?? "")}>
          <SelectTrigger className="w-full">
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
        <div className="max-w-56">
          <DatePicker
            value={value}
            onChange={setValue}
            captionLayout="dropdown"
            startMonth={new Date(new Date().getFullYear() - 100, 0, 1)}
            maxDate={requirement.preset === "birth_date" ? new Date() : undefined}
          />
        </div>
      ) : (
        <Input
          autoFocus
          value={value}
          maxLength={requirement.preset === "cpf" || requirement.preset === "phone" ? 20 : 300}
          inputMode={requirement.preset === "cpf" || requirement.preset === "phone" ? "numeric" : undefined}
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
            if (e.key === "Escape") onCancel();
          }}
        />
      )}
      <FormError message={error} />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

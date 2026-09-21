import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { judgesApi, type JudgeCatalogEntry } from "@/api/client";

export interface JudgeFormValues {
  name: string;
  email: string;
  userId: string;
}

interface JudgeFormFieldsProps {
  form: JudgeFormValues;
  onChange: (key: keyof JudgeFormValues, value: string) => void;
}

// Mesmo padrão de ProgramFormFields.tsx — "own" (entrada manual do
// catálogo do próprio produtor) não tem userId, então não dá pra usar
// um único namespace de id com as entradas "platform".
function catalogKey(entry: JudgeCatalogEntry): string {
  return entry.source === "platform" ? `platform:${entry.userId}` : `own:${entry.judgeId}`;
}

export function JudgeFormFields({ form, onChange }: JudgeFormFieldsProps) {
  const [catalog, setCatalog] = useState<JudgeCatalogEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState("");

  useEffect(() => {
    judgesApi.getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  // Email digitado que já é de uma conta da plataforma: o backend vincula
  // o jurado a ela e mostra SEMPRE o nome real da conta (o que foi
  // digitado no campo nome é descartado). Então já mostra o aviso, vincula
  // (userId, igual a escolher no catálogo) e trava o nome com o da conta.
  const typedEmail = form.email.trim().toLowerCase();
  const accountMatch =
    typedEmail === ""
      ? null
      : (catalog.find(
          (e) => e.source === "platform" && e.email.toLowerCase() === typedEmail,
        ) ?? null);
  // Nome que o usuário tinha digitado antes do vínculo automático, pra
  // devolver se ele trocar o email por um que não é de conta nenhuma.
  const typedNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (accountMatch) {
      if (typedNameRef.current === null) typedNameRef.current = form.name;
      if (form.userId !== (accountMatch.userId ?? "")) onChange("userId", accountMatch.userId ?? "");
      if (form.name !== accountMatch.name) onChange("name", accountMatch.name);
    } else if (typedNameRef.current !== null) {
      onChange("userId", "");
      onChange("name", typedNameRef.current);
      typedNameRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountMatch?.userId, accountMatch?.name]);

  function handleSelect(key: string) {
    setSelectedKey(key);
    const entry = catalog.find((e) => catalogKey(e) === key);
    if (!entry) return;
    // Entrada "platform": vincula de verdade (userId vai no payload).
    // Entrada "own": só copia os dados já digitados antes pra outro
    // evento — não é um vínculo de conta, então userId fica vazio.
    onChange("userId", entry.source === "platform" ? entry.userId ?? "" : "");
    onChange("name", entry.name);
    onChange("email", entry.email);
  }

  return (
    <>
      {catalog.length > 0 && (
        <div className="grid gap-2">
          <Label>
            Escolher jurado já conhecido{" "}
            <span className="text-sm font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Select value={selectedKey || null} onValueChange={(v) => handleSelect(v as string)}>
            <SelectTrigger className="w-full">
              {/* placeholder é ignorado pelo Base UI quando o filho é
                  função — ver PresentationDetailsDialog.tsx pro detalhe
                  do bug (2026-08-05). */}
              <SelectValue>
                {(value: string | null) =>
                  value
                    ? catalog.find((e) => catalogKey(e) === value)?.name
                    : "Cadastro manual (novo jurado)"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {catalog.map((entry) => {
                const alreadyUsedByMe = entry.source === "own" || entry.usedByMe;
                return (
                  <SelectItem key={catalogKey(entry)} value={catalogKey(entry)}>
                    <span className="flex w-full items-center justify-between gap-2">
                      <span>
                        {entry.name}{" "}
                        <span className="text-muted-foreground">({entry.email})</span>
                      </span>
                      {alreadyUsedByMe && <Badge variant="secondary">Já usado por você</Badge>}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {catalog.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou cadastre um novo jurado</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="judge-name">Nome do jurado</Label>
        <Input
          id="judge-name"
          value={form.name}
          onChange={(e) => onChange("name", e.target.value)}
          disabled={accountMatch !== null}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="judge-email">E-mail</Label>
        <Input
          id="judge-email"
          type="email"
          value={form.email}
          onChange={(e) => onChange("email", e.target.value)}
          required
        />
        {accountMatch && (
          <p className="text-xs text-muted-foreground">
            Este email já pertence a {accountMatch.name}
          </p>
        )}
      </div>
    </>
  );
}

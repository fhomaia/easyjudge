import { useEffect, useState } from "react";
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
import { programsApi, type ProgramCatalogEntry } from "@/api/client";

export interface ProgramFormValues {
  name: string;
  email: string;
  city: string;
  state: string;
  userId: string;
}

interface ProgramFormFieldsProps {
  form: ProgramFormValues;
  onChange: (key: keyof ProgramFormValues, value: string) => void;
}

// Chave só de uso local no Select — "own" (entrada manual do catálogo
// do próprio produtor) não tem userId, então não dá pra usar um único
// namespace de id com as entradas "platform".
function catalogKey(entry: ProgramCatalogEntry): string {
  return entry.source === "platform" ? `platform:${entry.userId}` : `own:${entry.programId}`;
}

export function ProgramFormFields({ form, onChange }: ProgramFormFieldsProps) {
  const [catalog, setCatalog] = useState<ProgramCatalogEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState("");

  useEffect(() => {
    programsApi.getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

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
    onChange("city", entry.city ?? "");
    onChange("state", entry.state ?? "");
  }

  return (
    <>
      {catalog.length > 0 && (
        <div className="grid gap-2">
          <Label>
            Escolher programa já conhecido{" "}
            <span className="text-sm font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Select value={selectedKey || null} onValueChange={(v) => handleSelect(v as string)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Cadastro manual (novo programa)">
                {(value: string) => catalog.find((e) => catalogKey(e) === value)?.name}
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
                      <Badge variant={alreadyUsedByMe ? "secondary" : "outline"}>
                        {alreadyUsedByMe ? "Já usado por você" : "Da plataforma"}
                      </Badge>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="program-name">Nome do programa</Label>
        <Input
          id="program-name"
          value={form.name}
          onChange={(e) => onChange("name", e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="program-email">E-mail</Label>
        <Input
          id="program-email"
          type="email"
          value={form.email}
          onChange={(e) => onChange("email", e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="program-city">Cidade</Label>
          <Input
            id="program-city"
            value={form.city}
            onChange={(e) => onChange("city", e.target.value)}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="program-state">Estado (UF)</Label>
          <Input
            id="program-state"
            maxLength={2}
            value={form.state}
            onChange={(e) => onChange("state", e.target.value.toUpperCase())}
            required
          />
        </div>
      </div>
    </>
  );
}

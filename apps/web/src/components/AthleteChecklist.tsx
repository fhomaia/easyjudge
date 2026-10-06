import { useState } from "react";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TruncatedText } from "@/components/TruncatedText";
import { cn } from "@/lib/utils";

export interface ChecklistItem {
  id: string;
  label: string;
  hint?: string;
  // Itens com grupo aparecem separados, um título por grupo, na ordem de
  // `groupOrder` (ex.: elegíveis primeiro).
  group?: string;
  // Não pode ser marcado (só desmarcado, se já estava): motivo em
  // vermelho embaixo, e um conteúdo extra opcional (ex.: informar data).
  blocked?: boolean;
  error?: string;
  extra?: React.ReactNode;
}

interface AthleteChecklistProps {
  items: ChecklistItem[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  searchPlaceholder: string;
  emptyMessage: string;
  // "20 de 24 atletas selecionados"
  countNoun: { singular: string; plural: string };
  groupOrder?: string[];
}

// Lista com busca e caixas de marcar, usada pra escolher atletas de uma
// categoria e categorias de um atleta.
export function AthleteChecklist({
  items,
  selected,
  onChange,
  searchPlaceholder,
  emptyMessage,
  countNoun,
  groupOrder,
}: AthleteChecklistProps) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const visible = items.filter(
    (item) =>
      item.label.toLowerCase().includes(query) ||
      (item.hint ?? "").toLowerCase().includes(query),
  );

  function toggle(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onChange(next);
  }

  // "Marcar todos" ignora os bloqueados.
  const markable = visible.filter((i) => !i.blocked || selected.has(i.id));
  const allVisibleSelected = markable.length > 0 && markable.every((i) => selected.has(i.id));
  function toggleAllVisible() {
    const next = new Set(selected);
    for (const item of markable) {
      if (allVisibleSelected) next.delete(item.id);
      else next.add(item.id);
    }
    onChange(next);
  }

  if (items.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="grid min-w-0 gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {selected.size} de {items.length}{" "}
          {items.length === 1 ? countNoun.singular : countNoun.plural}
        </span>
        {markable.length > 0 && (
          <button
            type="button"
            onClick={toggleAllVisible}
            className="font-medium text-primary hover:underline"
          >
            {allVisibleSelected ? "Desmarcar todos" : "Marcar todos"}
          </button>
        )}
      </div>
      <div className="grid max-h-72 grid-cols-[minmax(0,1fr)] gap-0.5 overflow-y-auto rounded-lg border border-border/60 p-1">
        {visible.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nada encontrado.</p>
        ) : groupOrder ? (
          groupOrder.map((group) => {
            const groupItems = visible.filter((i) => i.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={group} className="grid min-w-0 gap-0.5">
                <p className="px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group} ({groupItems.length})
                </p>
                {groupItems.map(renderItem)}
              </div>
            );
          })
        ) : (
          visible.map(renderItem)
        )}
      </div>
    </div>
  );

  function renderItem(item: ChecklistItem) {
    const disabled = !!item.blocked && !selected.has(item.id);
    return (
      <div key={item.id} className="grid min-w-0 gap-1 rounded-md px-2 py-2 hover:bg-muted/60">
        <label
          className={cn(
            "flex min-w-0 items-center gap-3 text-sm",
            disabled ? "cursor-not-allowed" : "cursor-pointer",
          )}
        >
          <Checkbox
            checked={selected.has(item.id)}
            disabled={disabled}
            onCheckedChange={(value) => toggle(item.id, value === true)}
          />
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block truncate",
                disabled ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {item.label}
            </span>
            {item.hint && (
              <TruncatedText text={item.hint} className="text-xs text-muted-foreground" />
            )}
            {item.error && <span className="block text-xs text-destructive">{item.error}</span>}
          </span>
        </label>
        {item.extra && <div className="pl-7">{item.extra}</div>}
      </div>
    );
  }
}


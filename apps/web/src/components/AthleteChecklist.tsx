import { useState } from "react";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export interface ChecklistItem {
  id: string;
  label: string;
  hint?: string;
}

interface AthleteChecklistProps {
  items: ChecklistItem[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  searchPlaceholder: string;
  emptyMessage: string;
  // "20 de 24 atletas selecionados"
  countNoun: { singular: string; plural: string };
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

  const allVisibleSelected = visible.length > 0 && visible.every((i) => selected.has(i.id));
  function toggleAllVisible() {
    const next = new Set(selected);
    for (const item of visible) {
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
        {visible.length > 0 && (
          <button
            type="button"
            onClick={toggleAllVisible}
            className="font-medium text-primary hover:underline"
          >
            {allVisibleSelected ? "Desmarcar todos" : "Marcar todos"}
          </button>
        )}
      </div>
      <div className="grid max-h-72 gap-0.5 overflow-y-auto rounded-lg border border-border/60 p-1">
        {visible.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nada encontrado.</p>
        ) : (
          visible.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
            >
              <Checkbox
                checked={selected.has(item.id)}
                onCheckedChange={(value) => toggle(item.id, value === true)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-foreground">{item.label}</span>
                {item.hint && (
                  <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
                )}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { SetReleasePayload } from "@/api/client";

type ReleaseChanges = Omit<SetReleasePayload, "dayId" | "categoryId">;

// As 3 chaves de liberação (notas, contestação, resultado), usadas tanto
// no dia quanto em cada categoria (ver AdminNotesOverview). Ligar
// contestação liga as notas junto e fechar as notas fecha a contestação
// (regra do backend, ReleasesService).
export function ReleaseToggles({
  scoresReleased,
  contestationReleased,
  resultsReleased,
  disabled,
  onChange,
  className,
}: {
  scoresReleased: boolean;
  contestationReleased: boolean;
  resultsReleased: boolean;
  disabled?: boolean;
  onChange: (changes: ReleaseChanges) => void;
  className?: string;
}) {
  const items: Array<[string, boolean, (v: boolean) => ReleaseChanges]> = [
    ["Notas", scoresReleased, (v) => ({ scoresReleased: v })],
    ["Contestação", contestationReleased, (v) => ({ contestationReleased: v })],
    ["Resultado", resultsReleased, (v) => ({ resultsReleased: v })],
  ];
  return (
    <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-2", className)}>
      {items.map(([label, checked, build]) => (
        <label key={label} className="flex items-center gap-2 text-sm text-foreground">
          <Switch
            checked={checked}
            disabled={disabled}
            onCheckedChange={(v) => onChange(build(v === true))}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

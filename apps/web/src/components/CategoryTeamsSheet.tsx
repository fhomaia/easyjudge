import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { Category, TeamWithProgram } from "@/api/client";

interface CategoryTeamsSheetProps {
  category: Category | null;
  teams: TeamWithProgram[];
  onOpenChange: (open: boolean) => void;
}

export function CategoryTeamsSheet({ category, teams, onOpenChange }: CategoryTeamsSheetProps) {
  return (
    <Sheet open={category !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{category?.name}</SheetTitle>
          <SheetDescription>
            {teams.length === 0
              ? "Nenhuma equipe inscrita nesta categoria ainda."
              : `${teams.length} ${teams.length === 1 ? "equipe inscrita" : "equipes inscritas"}`}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-1 overflow-y-auto px-4">
          {teams.map((team) => (
            <div
              key={team.id}
              className="flex items-center justify-between gap-3 rounded-md p-2 transition-colors hover:bg-muted/60"
            >
              <span className="text-sm font-medium text-foreground">{team.name}</span>
              <span className="text-xs text-muted-foreground">{team.program.name}</span>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

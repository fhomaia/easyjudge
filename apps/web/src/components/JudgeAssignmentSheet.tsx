import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { getAvatarColor } from "@/lib/avatarColor";
import type { Judge } from "@/api/client";

function getJudgeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0]?.toUpperCase() ?? "?";
  return `${words[0][0] ?? ""}${words[words.length - 1][0] ?? ""}`.toUpperCase();
}

export interface JudgeAssignmentTarget {
  title: string;
  description: string;
  assignedJudgeIds: string[];
}

interface JudgeAssignmentSheetProps {
  target: JudgeAssignmentTarget | null;
  judges: Judge[];
  onOpenChange: (open: boolean) => void;
  onToggleJudge: (judgeId: string, checked: boolean) => void;
}

export function JudgeAssignmentSheet({
  target,
  judges,
  onOpenChange,
  onToggleJudge,
}: JudgeAssignmentSheetProps) {
  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{target?.title}</SheetTitle>
          <SheetDescription>{target?.description}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-1 overflow-y-auto px-4">
          {judges.map((judge) => {
            const checked = target?.assignedJudgeIds.includes(judge.id) ?? false;
            return (
              <label
                key={judge.id}
                className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/60"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => onToggleJudge(judge.id, value === true)}
                />
                <span
                  style={{ backgroundColor: getAvatarColor(judge.id) }}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                >
                  {getJudgeInitials(judge.name)}
                </span>
                <span className="text-sm font-normal text-foreground">{judge.name}</span>
              </label>
            );
          })}
          {judges.length === 0 && (
            <p className="p-2 text-sm text-muted-foreground">
              Nenhum jurado cadastrado neste evento ainda.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

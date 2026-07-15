import { Crown, Pencil, Scale, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAvatarColor } from "@/lib/avatarColor";
import { SPECIAL_JUDGE_ROLES } from "@/lib/specialJudgeRoles";
import type { Judge, SpecialJudgeRole } from "@/api/client";

function getJudgeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0]?.toUpperCase() ?? "?";
  return `${words[0][0] ?? ""}${words[words.length - 1][0] ?? ""}`.toUpperCase();
}

const ROLE_ICONS: Record<SpecialJudgeRole, LucideIcon> = {
  legality_judge: Scale,
  head_judge: Crown,
};

// Cores fixas (mesma paleta vibrante de avatarColor.ts) — Head Judge
// combinando com o amarelo pedido, Jurado de Legalidade num azul da
// mesma família pra diferenciar.
const ROLE_COLORS: Record<SpecialJudgeRole, string> = {
  legality_judge: "#3b82f6",
  head_judge: "#f59e0b",
};

interface SpecialRolesCardProps {
  judgeIdsByRole: Map<SpecialJudgeRole, string[]>;
  judgesById: Map<string, Judge>;
  onEditRole: (role: SpecialJudgeRole) => void;
}

export function SpecialRolesCard({
  judgeIdsByRole,
  judgesById,
  onEditRole,
}: SpecialRolesCardProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-card">
      <div className="border-b border-border/60 px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">Funções especiais</h2>
      </div>

      <div className="grid grid-cols-1 divide-y divide-border/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {SPECIAL_JUDGE_ROLES.map(({ role, label, description, required }) => {
          const Icon = ROLE_ICONS[role];
          const judges = (judgeIdsByRole.get(role) ?? [])
            .map((id) => judgesById.get(id))
            .filter((j): j is Judge => !!j);

          return (
            <div key={role} className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-4">
                <div
                  style={{ backgroundColor: ROLE_COLORS[role] }}
                  className="flex size-12 shrink-0 items-center justify-center rounded-full text-white"
                >
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {label}
                    {required && (
                      <Badge
                        variant="outline"
                        className="border-transparent bg-destructive/10 text-destructive"
                      >
                        Obrigatório
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="flex items-center">
                  {judges.map((judge) => (
                    <span
                      key={judge.id}
                      title={judge.name}
                      style={{ backgroundColor: getAvatarColor(judge.id) }}
                      className="-ml-2 flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-card first:ml-0"
                    >
                      {getJudgeInitials(judge.name)}
                    </span>
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={() => onEditRole(role)}>
                  <Pencil data-icon="inline-start" />
                  Editar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

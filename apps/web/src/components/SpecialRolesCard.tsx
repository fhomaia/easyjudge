import { Crown, Scale, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getAvatarColor } from "@/lib/avatarColor";
import { assignmentKey } from "@/lib/judgingAssignments";
import { SPECIAL_JUDGE_ROLES } from "@/lib/specialJudgeRoles";
import type { Judge, SpecialJudgeRole } from "@/api/client";

function getJudgeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0]?.toUpperCase() ?? "?";
  return `${words[0][0] ?? ""}${words[words.length - 1][0] ?? ""}`.toUpperCase();
}

const MAX_VISIBLE_CHIPS = 2;

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
  resources: Array<{ id: string; name: string }>;
  judgeIdsByRoleResource: Map<string, string[]>;
  judgesById: Map<string, Judge>;
  selectedRole: SpecialJudgeRole | null;
  selectedResourceId: string | null;
  onSelectCell: (role: SpecialJudgeRole, resourceId: string) => void;
}

// Uma linha por função especial, uma coluna por recurso do dia
// selecionado — mesmo padrão de separação por pista da árvore de
// critérios (2026-07-19, a pedido do usuário): um jurado não pode
// estar em duas pistas ao mesmo tempo, então a função especial também
// precisa de um jurado por recurso, não um só pro dia inteiro.
export function SpecialRolesCard({
  resources,
  judgeIdsByRoleResource,
  judgesById,
  selectedRole,
  selectedResourceId,
  onSelectCell,
}: SpecialRolesCardProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">
        Funções especiais{" "}
        <span className="font-normal text-muted-foreground">
          (clique no recurso para atribuir o jurado responsável)
        </span>
      </h2>

      {resources.length > 0 && (
        <div
          style={{ gridTemplateColumns: `1.6fr repeat(${resources.length}, 160px)` }}
          className="grid gap-3 border-b border-border/60 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          <span>Função</span>
          {resources.map((resource) => (
            <span key={resource.id} className="truncate normal-case">
              {resource.name}
            </span>
          ))}
        </div>
      )}

      <div className="divide-y divide-border/60">
        {SPECIAL_JUDGE_ROLES.map(({ role, label, description, required }) => {
          const Icon = ROLE_ICONS[role];

          return (
            <div
              key={role}
              style={{ gridTemplateColumns: `1.6fr repeat(${resources.length}, 160px)` }}
              className="grid items-center gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <div
                  style={{ backgroundColor: ROLE_COLORS[role] }}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
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
                  <p className="truncate text-xs text-muted-foreground">{description}</p>
                </div>
              </div>

              {resources.map((resource) => {
                const judges = (judgeIdsByRoleResource.get(assignmentKey(role, resource.id)) ?? [])
                  .map((id) => judgesById.get(id))
                  .filter((j): j is Judge => !!j);
                const visibleJudges = judges.slice(0, MAX_VISIBLE_CHIPS);
                const overflowCount = judges.length - visibleJudges.length;
                const selected = selectedRole === role && selectedResourceId === resource.id;

                return (
                  <button
                    key={resource.id}
                    type="button"
                    onClick={() => onSelectCell(role, resource.id)}
                    className={cn(
                      "flex min-h-9 items-center rounded-md px-1.5 transition-colors hover:bg-muted/40",
                      selected && "bg-primary/[0.06]",
                    )}
                  >
                    {visibleJudges.map((judge) => (
                      <span
                        key={judge.id}
                        title={judge.name}
                        style={{ backgroundColor: getAvatarColor(judge.id) }}
                        className="-ml-2 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-card first:ml-0"
                      >
                        {getJudgeInitials(judge.name)}
                      </span>
                    ))}
                    {overflowCount > 0 && (
                      <span className="-ml-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-card">
                        +{overflowCount}
                      </span>
                    )}
                    {judges.length === 0 && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

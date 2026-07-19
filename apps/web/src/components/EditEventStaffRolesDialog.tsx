import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormError } from "@/components/FormError";
import {
  EVENT_MEMBER_ROLE_DESCRIPTIONS,
  EVENT_MEMBER_ROLE_LABELS,
  EVENT_MEMBER_ROLES_ORDER,
} from "@/lib/eventMemberRoles";
import {
  eventStaffApi,
  ApiError,
  type EventStaffMember,
  type EventMemberRole,
} from "@/api/client";

interface EditEventStaffRolesDialogProps {
  eventId: string;
  member: EventStaffMember | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: (member: EventStaffMember) => void;
}

export function EditEventStaffRolesDialog({
  eventId,
  member,
  onOpenChange,
  onUpdated,
}: EditEventStaffRolesDialogProps) {
  const [roles, setRoles] = useState<Set<EventMemberRole>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Não-controlado por defaultValue porque o dialog é o mesmo pros
  // "..." de qualquer linha — precisa resincronizar sempre que `member`
  // trocar (abrir pra uma pessoa diferente).
  useEffect(() => {
    setRoles(new Set(member?.roles ?? []));
    setError(null);
  }, [member]);

  function toggleRole(role: EventMemberRole, checked: boolean) {
    setRoles((prev) => {
      const next = new Set(prev);
      if (checked) next.add(role);
      else next.delete(role);
      return next;
    });
  }

  async function handleSubmit() {
    if (!member) return;
    if (roles.size === 0) {
      setError("Escolha pelo menos um papel para essa pessoa.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const updated = await eventStaffApi.updateRoles(eventId, member.id, {
        roles: Array.from(roles),
      });
      onUpdated(updated);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-lg">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">
            Editar papéis {member ? `de ${member.firstName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Uma pessoa pode acumular mais de um papel no mesmo evento.
          </DialogDescription>
        </div>

        <FormError message={error} />

        <div className="grid gap-2">
          {EVENT_MEMBER_ROLES_ORDER.map((role) => (
            <label
              key={role}
              className="flex items-start gap-2 rounded-lg border border-border/60 p-3 text-sm transition-colors hover:border-primary/30"
            >
              <Checkbox
                className="mt-0.5"
                checked={roles.has(role)}
                onCheckedChange={(value) => toggleRole(role, value === true)}
              />
              <span className="grid gap-0.5">
                <span className="font-medium text-foreground">
                  {EVENT_MEMBER_ROLE_LABELS[role]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {EVENT_MEMBER_ROLE_DESCRIPTIONS[role]}
                </span>
              </span>
            </label>
          ))}
        </div>

        <Button onClick={handleSubmit} disabled={loading} className="w-full">
          {loading ? "Salvando..." : "Salvar papéis"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

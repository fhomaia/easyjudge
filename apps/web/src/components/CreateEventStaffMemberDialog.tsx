import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface CreateEventStaffMemberDialogProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (member: EventStaffMember) => void;
}

export function CreateEventStaffMemberDialog({
  eventId,
  open,
  onOpenChange,
  onCreated,
}: CreateEventStaffMemberDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<Set<EventMemberRole>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setRoles(new Set());
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  function toggleRole(role: EventMemberRole, checked: boolean) {
    setRoles((prev) => {
      const next = new Set(prev);
      if (checked) next.add(role);
      else next.delete(role);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (roles.size === 0) {
      setError("Escolha pelo menos um papel para essa pessoa.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const member = await eventStaffApi.create(eventId, {
        firstName,
        lastName,
        email,
        roles: Array.from(roles),
      });
      onCreated(member);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-lg">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Adicionar pessoa</DialogTitle>
          <DialogDescription>
            Cadastre alguém pra fazer parte do evento e escolha o(s) papel(is) dela. Se a pessoa
            ainda não tem conta na plataforma, o convite fica pendente até ela se cadastrar com
            esse email.
          </DialogDescription>
        </div>

        <FormError message={error} />

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="staff-first-name">Nome</Label>
              <Input
                id="staff-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="staff-last-name">Sobrenome</Label>
              <Input
                id="staff-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Papéis</Label>
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

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Adicionando..." : "Adicionar pessoa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

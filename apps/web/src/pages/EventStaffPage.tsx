import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MoreHorizontal, Plus, Trash2, UserCog } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreateEventStaffMemberDialog } from "@/components/CreateEventStaffMemberDialog";
import { EditEventStaffRolesDialog } from "@/components/EditEventStaffRolesDialog";
import { getAvatarColor } from "@/lib/avatarColor";
import { EVENT_MEMBER_ROLE_LABELS } from "@/lib/eventMemberRoles";
import { useEventSetupGuard } from "@/lib/useEventSetupGuard";
import {
  eventsApi,
  eventStaffApi,
  usersApi,
  type Event,
  type EventStaffMember,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

function getInitials(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

export function EventStaffPage() {
  const { id } = useParams<{ id: string }>();
  useEventSetupGuard(id);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [members, setMembers] = useState<EventStaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<EventStaffMember | null>(null);
  const [removingMember, setRemovingMember] = useState<EventStaffMember | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then(setEvent).catch(() => setEvent(null));
    eventStaffApi
      .list(id)
      .then(setMembers)
      .catch(() => setError("Não foi possível carregar o roster de acessos."));
  }, [id]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleConfirmRemove() {
    if (!id || !removingMember) return;
    await eventStaffApi.remove(id, removingMember.id);
    setMembers((prev) => prev.filter((m) => m.id !== removingMember.id));
  }

  const isAdmin = event?.currentUserRoles.includes("admin") ?? false;

  return (
    <div className="flex h-svh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-10 pt-6">
          <button
            type="button"
            onClick={() => navigate(`/events/${id}/setup`)}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar para configuração do evento
          </button>
          <NotificationBell />
        </div>

        <div className="px-10 pb-10">
          {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

          {event && (
            <div className="grid gap-6">
              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserCog className="size-5" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold text-foreground">Gerenciar acessos</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Quem faz parte de &quot;{event.name}&quot; e com qual papel.
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus data-icon="inline-start" />
                    Adicionar pessoa
                  </Button>
                )}
              </div>

              <div className="rounded-lg border border-border/60 bg-card">
                <div className="divide-y divide-border/60">
                  {members.map((member) => {
                    const isSelf = profile?.id === member.userId;
                    const lockedForOthers = member.isOwner && !isSelf;

                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-4 p-4"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            style={{
                              backgroundColor: getAvatarColor(member.userId ?? member.id),
                            }}
                            className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                          >
                            {getInitials(member.firstName, member.lastName)}
                          </span>
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                              {member.firstName} {member.lastName}
                              {member.isOwner && (
                                <Badge
                                  variant="outline"
                                  className="border-transparent bg-primary/10 text-primary"
                                >
                                  Dono do evento
                                </Badge>
                              )}
                              {member.isPending && (
                                <Badge
                                  variant="outline"
                                  className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                >
                                  Convite pendente
                                </Badge>
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {member.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {member.roles.map((role) => (
                              <Badge key={role} variant="secondary">
                                {EVENT_MEMBER_ROLE_LABELS[role]}
                              </Badge>
                            ))}
                          </div>

                          {isAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-muted-foreground"
                                    disabled={lockedForOthers}
                                  />
                                }
                              >
                                <MoreHorizontal className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingMember(member)}>
                                  Editar papéis
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setRemovingMember(member)}
                                >
                                  <Trash2 data-icon="inline-start" />
                                  Remover
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {members.length === 0 && (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      Ninguém cadastrado no roster ainda.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {id && (
        <CreateEventStaffMemberDialog
          eventId={id}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(member) => setMembers((prev) => [...prev, member])}
        />
      )}

      {id && (
        <EditEventStaffRolesDialog
          eventId={id}
          member={editingMember}
          onOpenChange={(open) => !open && setEditingMember(null)}
          onUpdated={(updated) =>
            setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
          }
        />
      )}

      <ConfirmDialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
        title="Remover pessoa do evento"
        description={
          removingMember
            ? `${removingMember.firstName} ${removingMember.lastName} perderá todos os papéis (${removingMember.roles.map((r) => EVENT_MEMBER_ROLE_LABELS[r]).join(", ")}) e o acesso a este evento.`
            : ""
        }
        confirmLabel="Remover"
        confirmingLabel="Removendo..."
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}

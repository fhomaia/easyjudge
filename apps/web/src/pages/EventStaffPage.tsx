import { useEffect, useState } from "react";
import { PageLoadingOverlay } from "@/components/PageLoadingOverlay";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MoreHorizontal, Plus, Trash2, UserCog } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotificationsUnreadCount } from "@/lib/useNotificationsUnreadCount";
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
  const notificationsUnreadCount = useNotificationsUnreadCount(id);
  useEventSetupGuard(id);
  const navigate = useNavigate();
  // Aberta pelo menu do Início do evento ao vivo: "Sair" volta pra lá,
  // não pro Setup.
  const cameFromLive = (useLocation().state as { from?: string } | null)?.from === "live";
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
    <div className="flex h-dvh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      {/* `pt-14 sm:pt-0`: espaço da barra fixa do AppSidebar no celular. */}
      <main className="relative flex-1 overflow-y-auto pt-14 sm:pt-0">
        <PageLoadingOverlay loading={!event && !error} />
        <div className="flex items-center justify-between px-4 pt-6 sm:px-10">
          <button
            type="button"
            onClick={() => navigate(cameFromLive ? `/events/${id}/live` : `/events/${id}/setup`)}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Sair
          </button>
          <NotificationBell unreadCount={notificationsUnreadCount} />
        </div>

        <div className="px-4 pb-10 sm:px-10">
          {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

          {event && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserCog className="size-5" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold text-foreground">Gerenciar equipe</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Quem faz parte de &quot;{event.name}&quot; e com qual papel.
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
                    <Plus data-icon="inline-start" />
                    Adicionar
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
                        className="flex items-center justify-between gap-3 p-4 sm:gap-4"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span
                            style={{
                              backgroundColor: getAvatarColor(member.userId ?? member.id),
                            }}
                            className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                          >
                            {getInitials(member.firstName, member.lastName)}
                          </span>
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
                              <span className="min-w-0 truncate">
                                {member.firstName} {member.lastName}
                              </span>
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
                            {/* Celular: papéis embaixo do email (ao lado não
                                cabiam e cortavam a linha). */}
                            <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">
                              {member.roles.map((role) => (
                                <Badge key={role} variant="secondary">
                                  {EVENT_MEMBER_ROLE_LABELS[role]}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
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
                                  // O dono do evento nunca é removido.
                                  disabled={member.isOwner}
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

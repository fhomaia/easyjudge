import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { CalendarDays, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { AppSidebar, type SidebarSection } from "@/components/AppSidebar";
import { CreateEventDialog } from "@/components/CreateEventDialog";
import { EditEventDialog } from "@/components/EditEventDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EventStatusArea } from "@/components/EventStatusArea";
import { EventThumbnail } from "@/components/EventThumbnail";
import { Button } from "@/components/ui/button";
import { ApiError, eventsApi, usersApi, type Event, type UserProfile } from "@/api/client";
import { useAuthStore } from "@/store/auth";

function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

const listVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const listItemVariants: Variants = {
  hidden: { opacity: 0, x: -24 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

interface EventListItemProps {
  event: Event;
  starting: boolean;
  onStart: (event: Event) => void;
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
}

function EventListItem({ event, starting, onStart, onEdit, onDelete }: EventListItemProps) {
  const isAdmin = event.currentUserRole === "admin";

  return (
    <motion.div
      variants={listItemVariants}
      whileHover={{ y: -2 }}
      className="flex items-center gap-4 rounded-lg border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-md"
    >
      <EventThumbnail name={event.name} logoUrl={event.logoUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{event.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {formatDate(event.startDate)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            {event.location}
          </span>
        </div>
      </div>

      <EventStatusArea event={event} starting={starting} onStart={() => onStart(event)} />

      {isAdmin && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(event)}
            aria-label="Editar evento"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(event)}
            aria-label="Excluir evento"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [activeSection, setActiveSection] = useState<SidebarSection>("events");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Event | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
    eventsApi.list().then(setEvents).catch(() => setEvents([]));
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function handleEventCreated(event: Event) {
    setEvents((prev) => [event, ...(prev ?? [])]);
  }

  function handleEventUpdated(event: Event) {
    setEvents((prev) => prev?.map((e) => (e.id === event.id ? event : e)) ?? prev);
  }

  async function handleStart(event: Event) {
    setError(null);
    setStartingId(event.id);
    try {
      const updated = await eventsApi.start(event.id);
      handleEventUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setStartingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    await eventsApi.remove(id);
    setEvents((prev) => prev?.filter((e) => e.id !== id) ?? prev);
  }

  return (
    <div className="flex min-h-svh bg-background">
      <AppSidebar
        profile={profile}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-y-auto p-10">
        <AnimatePresence mode="wait">
          {activeSection === "events" && events !== null && (
            <motion.div
              key="events"
              initial="hidden"
              animate="show"
              exit={{ opacity: 0 }}
            >
              {events.length === 0 ? (
                <motion.div
                  variants={listItemVariants}
                  className="flex h-full min-h-[70vh] items-center justify-center"
                >
                  <Button size="lg" onClick={() => setCreateOpen(true)}>
                    <Plus data-icon="inline-start" />
                    Criar evento
                  </Button>
                </motion.div>
              ) : (
                <div className="grid gap-6">
                  <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold text-foreground">Eventos</h1>
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus data-icon="inline-start" />
                      Criar evento
                    </Button>
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <motion.div variants={listVariants} className="grid gap-3">
                    {events.map((event) => (
                      <EventListItem
                        key={event.id}
                        event={event}
                        starting={startingId === event.id}
                        onStart={handleStart}
                        onEdit={setEditTarget}
                        onDelete={setDeleteTarget}
                      />
                    ))}
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <CreateEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleEventCreated}
      />

      <EditEventDialog
        event={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onUpdated={handleEventUpdated}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir evento"
        description={`Tem certeza que quer excluir "${deleteTarget?.name}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        confirmingLabel="Excluindo..."
        onConfirm={handleDelete}
      />
    </div>
  );
}

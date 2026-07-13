import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { AppSidebar, type SidebarSection } from "@/components/AppSidebar";
import { CreateEventDialog } from "@/components/CreateEventDialog";
import { EditEventDialog } from "@/components/EditEventDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EventStatCards } from "@/components/EventStatCards";
import { NotificationBell } from "@/components/NotificationBell";
import {
  EventFiltersBar,
  type EventSortOption,
  type EventStatusFilter,
  type EventViewMode,
} from "@/components/EventFiltersBar";
import { EventListItem } from "@/components/EventListItem";
import { EventGridItem } from "@/components/EventGridItem";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { listVariants } from "@/lib/motionVariants";
import { ApiError, eventsApi, usersApi, type Event, type UserProfile } from "@/api/client";
import { useAuthStore } from "@/store/auth";

const PAGE_SIZE = 5;

function sortEvents(events: Event[], sort: EventSortOption): Event[] {
  const sorted = [...events];
  if (sort === "recent") {
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sort === "oldest") {
    sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else {
    sorted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }
  return sorted;
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
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EventStatusFilter>("all");
  const [sort, setSort] = useState<EventSortOption>("recent");
  const [view, setView] = useState<EventViewMode>("list");
  const [page, setPage] = useState(1);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
    eventsApi.list().then(setEvents).catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sort]);

  const filteredEvents = useMemo(() => {
    const list = events ?? [];
    const query = search.trim().toLowerCase();
    const filtered = list.filter((event) => {
      if (statusFilter !== "all" && event.status !== statusFilter) return false;
      if (query && !event.name.toLowerCase().includes(query)) return false;
      return true;
    });
    return sortEvents(filtered, sort);
  }, [events, search, statusFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function handleEventCreated(event: Event) {
    setEvents((prev) => [event, ...(prev ?? [])]);
  }

  function handleEventUpdated(event: Event) {
    setEvents((prev) => prev?.map((e) => (e.aliasId === event.aliasId ? event : e)) ?? prev);
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

  async function handlePublish(event: Event) {
    setError(null);
    setPublishingId(event.id);
    try {
      const updated = await eventsApi.publish(event.id);
      handleEventUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setPublishingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    await eventsApi.remove(id);
    setEvents((prev) => prev?.filter((e) => e.id !== id) ?? prev);
  }

  const hasAnyEvents = (events?.length ?? 0) > 0;
  const showingFrom = filteredEvents.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(currentPage * PAGE_SIZE, filteredEvents.length);

  return (
    <div className="flex min-h-svh bg-background">
      <AppSidebar
        profile={profile}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="flex justify-end px-10 pt-6">
          <NotificationBell />
        </div>

        <div className="px-10 pb-10">
          <AnimatePresence mode="wait">
            {activeSection === "events" && events !== null && (
              <motion.div key="events" initial="hidden" animate="show" exit={{ opacity: 0 }}>
                <div className="grid gap-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-semibold text-foreground">Meus eventos</h1>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Gerencie todos os seus eventos de cheerleading.
                      </p>
                    </div>
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus data-icon="inline-start" />
                      Novo evento
                    </Button>
                  </div>

                  <EventStatCards events={events} />

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  {hasAnyEvents ? (
                    <>
                      <EventFiltersBar
                        search={search}
                        onSearchChange={setSearch}
                        statusFilter={statusFilter}
                        onStatusFilterChange={setStatusFilter}
                        sort={sort}
                        onSortChange={setSort}
                        view={view}
                        onViewChange={setView}
                      />

                      {filteredEvents.length === 0 ? (
                        <p className="py-16 text-center text-sm text-muted-foreground">
                          Nenhum evento encontrado com esses filtros.
                        </p>
                      ) : (
                        <motion.div
                          key={view}
                          variants={listVariants}
                          initial="hidden"
                          animate="show"
                          className={
                            view === "list"
                              ? "grid gap-3"
                              : "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
                          }
                        >
                          {paginatedEvents.map((event) =>
                            view === "list" ? (
                              <EventListItem
                                key={event.id}
                                event={event}
                                starting={startingId === event.id}
                                onStart={handleStart}
                                publishing={publishingId === event.id}
                                onPublish={handlePublish}
                                onEdit={setEditTarget}
                                onDelete={setDeleteTarget}
                              />
                            ) : (
                              <EventGridItem
                                key={event.id}
                                event={event}
                                starting={startingId === event.id}
                                onStart={handleStart}
                                publishing={publishingId === event.id}
                                onPublish={handlePublish}
                                onEdit={setEditTarget}
                                onDelete={setDeleteTarget}
                              />
                            ),
                          )}
                        </motion.div>
                      )}

                      {filteredEvents.length > 0 && (
                        <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-between">
                          <p className="text-sm text-muted-foreground">
                            Mostrando {showingFrom} a {showingTo} de {filteredEvents.length} eventos
                          </p>
                          <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex min-h-[50vh] items-center justify-center">
                      <Button size="lg" onClick={() => setCreateOpen(true)}>
                        <Plus data-icon="inline-start" />
                        Criar evento
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <CreateEventDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={handleEventCreated} />

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

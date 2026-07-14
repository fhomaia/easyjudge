import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarDays, MapPin, Plus } from "lucide-react";
import { AppSidebar, type SidebarSection } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { EventThumbnail } from "@/components/EventThumbnail";
import { CategoryStatCards } from "@/components/CategoryStatCards";
import {
  CategoryFiltersBar,
  type CategoryModalityFilter,
  type CategorySortOption,
  type CategoryStatusFilter,
  type CategoryViewMode,
} from "@/components/CategoryFiltersBar";
import { CategoryTable } from "@/components/CategoryTable";
import { CategoryGridItem } from "@/components/CategoryGridItem";
import { CreateCategoryDialog } from "@/components/CreateCategoryDialog";
import { EditCategoryDialog } from "@/components/EditCategoryDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatDate";
import { listVariants } from "@/lib/motionVariants";
import {
  ApiError,
  categoriesApi,
  eventsApi,
  usersApi,
  type Category,
  type Event,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

const PAGE_SIZE = 5;

function sortCategories(categories: Category[], sort: CategorySortOption): Category[] {
  const sorted = [...categories];
  if (sort === "recent") {
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sort === "oldest") {
    sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else {
    sorted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }
  return sorted;
}

export function CategoriesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [activeSection, setActiveSection] = useState<SidebarSection>("events");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CategoryStatusFilter>("all");
  const [modalityFilter, setModalityFilter] = useState<CategoryModalityFilter>("all");
  const [sort, setSort] = useState<CategorySortOption>("recent");
  const [view, setView] = useState<CategoryViewMode>("list");
  const [page, setPage] = useState(1);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    eventsApi
      .get(id)
      .then(setEvent)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar o evento."),
      );
    categoriesApi
      .list(id)
      .then(setCategories)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Não foi possível carregar as categorias.",
        ),
      );
  }, [id]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, modalityFilter, sort]);

  const filteredCategories = useMemo(() => {
    const list = categories ?? [];
    const query = search.trim().toLowerCase();
    const filtered = list.filter((category) => {
      if (statusFilter !== "all" && category.status !== statusFilter) return false;
      if (modalityFilter !== "all" && category.modality !== modalityFilter) return false;
      if (query && !category.name.toLowerCase().includes(query)) return false;
      return true;
    });
    return sortCategories(filtered, sort);
  }, [categories, search, statusFilter, modalityFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedCategories = filteredCategories.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function handleSelectSection(section: SidebarSection) {
    setActiveSection(section);
    navigate("/");
  }

  function handleCreated(category: Category) {
    setCategories((prev) => [category, ...(prev ?? [])]);
  }

  function handleUpdated(category: Category) {
    setCategories((prev) => prev?.map((c) => (c.id === category.id ? category : c)) ?? prev);
  }

  async function handleDelete() {
    if (!deleteTarget || !id) return;
    const categoryId = deleteTarget.id;
    await categoriesApi.remove(id, categoryId);
    setCategories((prev) => prev?.filter((c) => c.id !== categoryId) ?? prev);
  }

  const hasAnyCategories = (categories?.length ?? 0) > 0;
  const showingFrom = filteredCategories.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(currentPage * PAGE_SIZE, filteredCategories.length);

  return (
    <div className="flex min-h-svh bg-background">
      <AppSidebar
        profile={profile}
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        onLogout={handleLogout}
      />

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
            <div className="mt-4 flex items-center gap-4">
              <EventThumbnail
                name={event.name}
                logoUrl={event.logoUrl}
                className="size-16 rounded-xl text-base"
              />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-foreground">{event.name}</p>
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
            </div>
          )}

          {categories !== null && (
            <div className="mt-6 grid gap-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">Categorias do evento</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Gerencie todas as categorias que farão parte do seu evento.
                  </p>
                </div>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus data-icon="inline-start" />
                  Adicionar categoria
                </Button>
              </div>

              <CategoryStatCards categories={categories} />

              {hasAnyCategories ? (
                <>
                  <CategoryFiltersBar
                    search={search}
                    onSearchChange={setSearch}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    modalityFilter={modalityFilter}
                    onModalityFilterChange={setModalityFilter}
                    sort={sort}
                    onSortChange={setSort}
                    view={view}
                    onViewChange={setView}
                  />

                  {filteredCategories.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      Nenhuma categoria encontrada com esses filtros.
                    </p>
                  ) : view === "list" ? (
                    <CategoryTable
                      categories={paginatedCategories}
                      onEdit={setEditTarget}
                      onDelete={setDeleteTarget}
                    />
                  ) : (
                    <motion.div
                      key="grid"
                      variants={listVariants}
                      initial="hidden"
                      animate="show"
                      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
                    >
                      {paginatedCategories.map((category) => (
                        <CategoryGridItem
                          key={category.id}
                          category={category}
                          onEdit={setEditTarget}
                          onDelete={setDeleteTarget}
                        />
                      ))}
                    </motion.div>
                  )}

                  {filteredCategories.length > 0 && (
                    <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Mostrando {showingFrom} a {showingTo} de {filteredCategories.length}{" "}
                        categorias
                      </p>
                      <Pagination
                        page={currentPage}
                        totalPages={totalPages}
                        onPageChange={setPage}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex min-h-[40vh] items-center justify-center">
                  <Button size="lg" onClick={() => setCreateOpen(true)}>
                    <Plus data-icon="inline-start" />
                    Adicionar categoria
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {id && (
        <CreateCategoryDialog
          eventId={id}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={handleCreated}
        />
      )}

      {id && (
        <EditCategoryDialog
          eventId={id}
          category={editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          onUpdated={handleUpdated}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir categoria"
        description={`Tem certeza que quer excluir "${deleteTarget?.name}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        confirmingLabel="Excluindo..."
        onConfirm={handleDelete}
      />
    </div>
  );
}

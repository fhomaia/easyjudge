import { useEffect, useMemo, useState } from "react";
import { PageLoadingOverlay } from "@/components/PageLoadingOverlay";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  MapPin,
  Plus,
  Star,
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotificationsUnreadCount } from "@/lib/useNotificationsUnreadCount";
import { EventThumbnail } from "@/components/EventThumbnail";
import { CategoryStatCards } from "@/components/CategoryStatCards";
import {
  CategoryFiltersBar,
  type CategorySortOption,
  type CategoryStatusFilter,
  type CategoryViewMode,
} from "@/components/CategoryFiltersBar";
import { CategoryTable } from "@/components/CategoryTable";
import { CategoryGridItem } from "@/components/CategoryGridItem";
import {
  CategoryFiltersPopover,
  EMPTY_CATEGORY_FILTER,
  filterCategories,
  type CategoryFilterState,
} from "@/components/CategoryFilters";

import { CategoryTeamsSheet } from "@/components/CategoryTeamsSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatDate";
import { listVariants } from "@/lib/motionVariants";
import { useEventSetupGuard } from "@/lib/useEventSetupGuard";
import { useIsMobile } from "@/lib/useIsMobile";
import {
  ApiError,
  categoriesApi,
  categoryCriteriaApi,
  eventsApi,
  teamsApi,
  usersApi,
  type Category,
  type CategoryCriterion,
  type Event,
  type TeamWithProgram,
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
  const notificationsUnreadCount = useNotificationsUnreadCount(id);
  useEventSetupGuard(id);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [criteria, setCriteria] = useState<CategoryCriterion[] | null>(null);
  const [teams, setTeams] = useState<TeamWithProgram[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [teamsTarget, setTeamsTarget] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CategoryStatusFilter>("all");
  const [criteriaFilter, setCriteriaFilter] =
    useState<CategoryFilterState>(EMPTY_CATEGORY_FILTER);
  const [sort, setSort] = useState<CategorySortOption>("recent");
  const [teamSort, setTeamSort] = useState<"asc" | "desc" | null>(null);
  const [view, setView] = useState<CategoryViewMode>("list");
  // Celular: sempre em cartões (a tabela não cabe na largura); a troca de
  // visualização some do filtro.
  const isMobile = useIsMobile();
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
    categoryCriteriaApi
      .get(id)
      .then(setCriteria)
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar os critérios de divisão.",
        ),
      );
    teamsApi
      .listForEvent(id)
      .then(setTeams)
      .catch(() => setTeams([]));
  }, [id]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, criteriaFilter, sort, teamSort]);

  const teamsByCategory = useMemo(() => {
    const map = new Map<string, TeamWithProgram[]>();
    for (const team of teams) {
      for (const category of team.categories) {
        map.set(category.id, [...(map.get(category.id) ?? []), team]);
      }
    }
    return map;
  }, [teams]);

  const teamCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [categoryId, categoryTeams] of teamsByCategory) {
      counts.set(categoryId, categoryTeams.length);
    }
    return counts;
  }, [teamsByCategory]);

  const filteredCategories = useMemo(() => {
    const list = filterCategories(categories ?? [], { ...criteriaFilter, search });
    const filtered = list.filter(
      (category) => statusFilter === "all" || category.status === statusFilter,
    );
    if (teamSort) {
      const sorted = [...filtered];
      sorted.sort((a, b) => {
        const diff = (teamCounts.get(a.id) ?? 0) - (teamCounts.get(b.id) ?? 0);
        const ordered = teamSort === "asc" ? diff : -diff;
        return ordered || a.name.localeCompare(b.name, "pt-BR");
      });
      return sorted;
    }
    return sortCategories(filtered, sort);
  }, [categories, search, statusFilter, criteriaFilter, sort, teamSort, teamCounts]);

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

  function openEdit(category: Category) {
    navigate(`/events/${id}/categories/${category.id}/edit`);
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
    <div className="flex h-dvh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      {/* `pt-14 sm:pt-0`: espaço da barra fixa do AppSidebar no celular. */}
      <main className="relative flex-1 overflow-y-auto pt-14 sm:pt-0">
        <PageLoadingOverlay
          loading={(!event || categories === null || criteria === null) && !error}
        />
        <div className="flex items-center justify-between px-4 pt-6 sm:px-10">
          <button
            type="button"
            onClick={() => navigate(`/events/${id}/setup`)}
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

          {categories !== null && criteria !== null && (
            <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold text-foreground">Categorias do evento</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Gerencie todas as categorias que farão parte do seu evento.
                  </p>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => navigate(`/events/${id}/categories/new`)}
                >
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
                    filters={
                      <CategoryFiltersPopover
                        categories={categories}
                        criteria={criteria}
                        value={criteriaFilter}
                        onChange={setCriteriaFilter}
                        className="w-full sm:w-auto"
                      />
                    }
                    sort={sort}
                    onSortChange={setSort}
                    view={view}
                    onViewChange={setView}
                  />

                  {filteredCategories.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      Nenhuma categoria encontrada com esses filtros.
                    </p>
                  ) : view === "list" && !isMobile ? (
                    <CategoryTable
                      categories={paginatedCategories}
                      teamCounts={teamCounts}
                      teamSort={teamSort}
                      onTeamSortChange={setTeamSort}
                      onEdit={openEdit}
                      onDelete={setDeleteTarget}
                      onViewTeams={setTeamsTarget}
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
                          teamCount={teamCounts.get(category.id) ?? 0}
                          onEdit={openEdit}
                          onDelete={setDeleteTarget}
                          onViewTeams={setTeamsTarget}
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
                  <Button size="lg" onClick={() => navigate(`/events/${id}/categories/new`)}>
                    <Plus data-icon="inline-start" />
                    Adicionar categoria
                  </Button>
                </div>
              )}

              <div className="flex flex-col gap-4 rounded-xl border border-amber-300/60 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-amber-400/20 dark:bg-amber-500/10">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400">
                    <Star className="size-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Próxima etapa recomendada</p>
                    <p className="text-sm text-muted-foreground">
                      Agora cuide das inscrições: receba as fichas dos programas ou cadastre
                      programas, equipes e atletas, vinculando cada equipe às categorias.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/events/${id}/programs`)}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  Ir para inscrições
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <CategoryTeamsSheet
        category={teamsTarget}
        teams={teamsTarget ? (teamsByCategory.get(teamsTarget.id) ?? []) : []}
        onOpenChange={(open) => !open && setTeamsTarget(null)}
      />

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

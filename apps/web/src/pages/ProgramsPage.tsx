import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { EventThumbnail } from "@/components/EventThumbnail";
import { CreateProgramDialog } from "@/components/CreateProgramDialog";
import { EditProgramDialog } from "@/components/EditProgramDialog";
import { CreateTeamDialog } from "@/components/CreateTeamDialog";
import { EditTeamDialog } from "@/components/EditTeamDialog";
import { AddTeamCategoryPopover } from "@/components/AddTeamCategoryPopover";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/Pagination";
import { getAvatarColor } from "@/lib/avatarColor";
import {
  categoriesApi,
  programsApi,
  teamsApi,
  usersApi,
  type Category,
  type Program,
  type ProgramWithTeams,
  type Team,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

const PAGE_SIZE = 6;

export function ProgramsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<ProgramWithTeams | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [createProgramOpen, setCreateProgramOpen] = useState(false);
  const [editProgramTarget, setEditProgramTarget] = useState<Program | null>(null);
  const [deleteProgramTarget, setDeleteProgramTarget] = useState<Program | null>(null);

  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [editTeamTarget, setEditTeamTarget] = useState<Team | null>(null);
  const [deleteTeamTarget, setDeleteTeamTarget] = useState<Team | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    programsApi
      .list(id)
      .then(setPrograms)
      .catch(() => setError("Não foi possível carregar os programas."));
    categoriesApi.list(id).then(setCategories).catch(() => setCategories([]));
  }, [id]);

  useEffect(() => {
    if (!id || !selectedProgramId) {
      setSelectedProgram(null);
      return;
    }
    programsApi
      .get(id, selectedProgramId)
      .then(setSelectedProgram)
      .catch(() => setSelectedProgram(null));
  }, [id, selectedProgramId]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function handleProgramCreated(program: Program) {
    setPrograms((prev) => [program, ...(prev ?? [])]);
    setSelectedProgramId(program.id);
  }

  function handleProgramUpdated(program: Program) {
    setPrograms((prev) => prev?.map((p) => (p.id === program.id ? program : p)) ?? prev);
    setSelectedProgram((prev) => (prev ? { ...prev, ...program } : prev));
  }

  async function handleDeleteProgram() {
    if (!id || !deleteProgramTarget) return;
    const programId = deleteProgramTarget.id;
    await programsApi.remove(id, programId);
    setPrograms((prev) => prev?.filter((p) => p.id !== programId) ?? prev);
    if (selectedProgramId === programId) setSelectedProgramId(null);
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !id || !selectedProgramId) return;
    const updated = await programsApi.uploadLogo(id, selectedProgramId, file);
    handleProgramUpdated(updated);
  }

  function handleTeamCreated(team: Team) {
    setSelectedProgram((prev) => (prev ? { ...prev, teams: [...prev.teams, team] } : prev));
    setPrograms((prev) =>
      prev?.map((p) =>
        p.id === selectedProgramId ? { ...p, teamsCount: (p.teamsCount ?? 0) + 1 } : p,
      ) ?? prev,
    );
  }

  function handleTeamUpdated(team: Team) {
    setSelectedProgram((prev) =>
      prev ? { ...prev, teams: prev.teams.map((t) => (t.id === team.id ? team : t)) } : prev,
    );
  }

  async function handleDeleteTeam() {
    if (!id || !selectedProgramId || !deleteTeamTarget) return;
    const teamId = deleteTeamTarget.id;
    await teamsApi.remove(id, selectedProgramId, teamId);
    setSelectedProgram((prev) =>
      prev ? { ...prev, teams: prev.teams.filter((t) => t.id !== teamId) } : prev,
    );
    setPrograms((prev) =>
      prev?.map((p) =>
        p.id === selectedProgramId ? { ...p, teamsCount: Math.max(0, (p.teamsCount ?? 1) - 1) } : p,
      ) ?? prev,
    );
  }

  async function handleAddCategory(teamId: string, categoryId: string) {
    if (!id || !selectedProgramId) return;
    const team = await teamsApi.addCategory(id, selectedProgramId, teamId, categoryId);
    handleTeamUpdated(team);
  }

  async function handleRemoveCategory(teamId: string, categoryId: string) {
    if (!id || !selectedProgramId) return;
    const team = await teamsApi.removeCategory(id, selectedProgramId, teamId, categoryId);
    handleTeamUpdated(team);
  }

  const filteredPrograms = (programs ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filteredPrograms.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedPrograms = filteredPrograms.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const hasAnyPrograms = (programs?.length ?? 0) > 0;

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

          {programs !== null && (
            <div className="mt-6 grid gap-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">Programas e equipes</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cadastre os programas participantes e as equipes inscritas em cada categoria.
                  </p>
                </div>
                <Button onClick={() => setCreateProgramOpen(true)}>
                  <Plus data-icon="inline-start" />
                  Novo programa
                </Button>
              </div>

              {hasAnyPrograms ? (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
                  <div className="grid gap-4">
                    <div className="relative self-start">
                      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Buscar programa..."
                        className="pl-11"
                      />
                    </div>

                    <div className="grid gap-2">
                      {paginatedPrograms.map((program) => (
                        <button
                          key={program.id}
                          type="button"
                          onClick={() => setSelectedProgramId(program.id)}
                          className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                            program.id === selectedProgramId
                              ? "border-primary/40 bg-primary/[0.05]"
                              : "border-border/60 bg-card hover:border-primary/30"
                          }`}
                        >
                          <EventThumbnail
                            name={program.name}
                            logoUrl={program.logoUrl}
                            className="size-11 rounded-lg text-sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {program.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {program.city} · {program.state}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {program.teamsCount ?? 0} {program.teamsCount === 1 ? "equipe" : "equipes"}
                          </span>
                        </button>
                      ))}
                      {filteredPrograms.length === 0 && (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          Nenhum programa encontrado.
                        </p>
                      )}
                    </div>

                    <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
                  </div>

                  <div>
                    {selectedProgram ? (
                      <div className="grid gap-4">
                        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-card p-5">
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => logoInputRef.current?.click()}
                              aria-label="Alterar logo do programa"
                            >
                              <EventThumbnail
                                name={selectedProgram.name}
                                logoUrl={selectedProgram.logoUrl}
                                className="size-14 rounded-xl text-base"
                              />
                            </button>
                            <input
                              ref={logoInputRef}
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/svg+xml"
                              className="hidden"
                              onChange={handleLogoChange}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-lg font-semibold text-foreground">
                                  {selectedProgram.name}
                                </p>
                                {selectedProgram.userId && (
                                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                    Vinculado
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  <MapPin className="size-3.5" />
                                  {selectedProgram.city} · {selectedProgram.state}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Mail className="size-3.5" />
                                  {selectedProgram.email}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {selectedProgram.userId ? (
                              <p
                                title="Este programa já está vinculado a uma conta própria — os dados são editados pelo próprio programa."
                                className="max-w-48 text-right text-xs text-muted-foreground"
                              >
                                Gerenciado pela própria conta do programa
                              </p>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditProgramTarget(selectedProgram)}
                                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <Pencil className="size-3.5" />
                                Editar dados do programa
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteProgramTarget(selectedProgram)}
                              aria-label="Excluir programa"
                              className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-4 rounded-lg border border-border/60 bg-card p-5">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                                Equipes do programa
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  {selectedProgram.teams.length}
                                </span>
                              </h2>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Cada equipe pode participar de uma ou mais categorias.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCreateTeamOpen(true)}
                              className="flex shrink-0 items-center gap-1.5 rounded-md border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                            >
                              <Plus className="size-4" />
                              Nova equipe
                            </button>
                          </div>

                          {selectedProgram.teams.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">
                              Nenhuma equipe cadastrada ainda.
                            </p>
                          ) : (
                            <div className="grid gap-2">
                              {selectedProgram.teams.map((team) => (
                                <div
                                  key={team.id}
                                  className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
                                >
                                  <div
                                    style={{ backgroundColor: getAvatarColor(team.id) }}
                                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
                                  >
                                    <Users className="size-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground">
                                      {team.name}
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                      {team.categories.map((category) => (
                                        <span
                                          key={category.id}
                                          className="group flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary"
                                        >
                                          {category.name}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemoveCategory(team.id, category.id)
                                            }
                                            aria-label={`Remover ${category.name}`}
                                            className="opacity-60 hover:opacity-100"
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ))}
                                      <AddTeamCategoryPopover
                                        team={team}
                                        categories={categories}
                                        onAdd={(categoryId) =>
                                          handleAddCategory(team.id, categoryId)
                                        }
                                      />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setEditTeamTarget(team)}
                                      aria-label="Editar equipe"
                                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    >
                                      <Pencil className="size-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteTeamTarget(team)}
                                      aria-label="Excluir equipe"
                                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                    >
                                      <Trash2 className="size-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-[40vh] items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
                        Selecione um programa pra ver os detalhes.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[40vh] items-center justify-center">
                  <Button size="lg" onClick={() => setCreateProgramOpen(true)}>
                    <Plus data-icon="inline-start" />
                    Novo programa
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {id && (
        <CreateProgramDialog
          eventId={id}
          open={createProgramOpen}
          onOpenChange={setCreateProgramOpen}
          onCreated={handleProgramCreated}
        />
      )}

      {id && (
        <EditProgramDialog
          eventId={id}
          program={editProgramTarget}
          onOpenChange={(open) => !open && setEditProgramTarget(null)}
          onUpdated={handleProgramUpdated}
        />
      )}

      {id && selectedProgramId && (
        <CreateTeamDialog
          eventId={id}
          programId={selectedProgramId}
          open={createTeamOpen}
          onOpenChange={setCreateTeamOpen}
          onCreated={handleTeamCreated}
        />
      )}

      {id && selectedProgramId && (
        <EditTeamDialog
          eventId={id}
          programId={selectedProgramId}
          team={editTeamTarget}
          onOpenChange={(open) => !open && setEditTeamTarget(null)}
          onUpdated={handleTeamUpdated}
        />
      )}

      <ConfirmDialog
        open={deleteProgramTarget !== null}
        onOpenChange={(open) => !open && setDeleteProgramTarget(null)}
        title="Excluir programa"
        description={`Tem certeza que quer excluir "${deleteProgramTarget?.name}"? Todas as ${deleteProgramTarget?.teamsCount ?? 0} equipes dele também serão apagadas. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        confirmingLabel="Excluindo..."
        onConfirm={handleDeleteProgram}
      />

      <ConfirmDialog
        open={deleteTeamTarget !== null}
        onOpenChange={(open) => !open && setDeleteTeamTarget(null)}
        title="Excluir equipe"
        description={`Tem certeza que quer excluir "${deleteTeamTarget?.name}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        confirmingLabel="Excluindo..."
        onConfirm={handleDeleteTeam}
      />
    </div>
  );
}

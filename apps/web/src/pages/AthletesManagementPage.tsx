import { useEffect, useState } from "react";
import { usePendingAthleteLinksStore } from "@/store/pendingAthleteLinks";
import { PageLoadingOverlay } from "@/components/PageLoadingOverlay";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Plus, Trash2, Users } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreateAthleteDialog } from "@/components/CreateAthleteDialog";
import { getAvatarColor } from "@/lib/avatarColor";
import { athletesApi, usersApi, type AthleteLinkView, type UserProfile } from "@/api/client";
import { useAuthStore } from "@/store/auth";

function getInitials(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

// Elenco de atletas do PRÓPRIO programa logado — global, fora de
// qualquer evento (ver AthletesService/AthleteLink no backend). Uma
// vez confirmado (ou mesmo pendente, pra visualização), o atleta ganha
// acesso automático a todos os eventos deste programa — não precisa
// ser adicionado evento por evento.
export function AthletesManagementPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [athletes, setAthletes] = useState<AthleteLinkView[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [removing, setRemoving] = useState<AthleteLinkView | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    usersApi
      .me()
      .then((p) => {
        setProfile(p);
        if (p.role !== "program") navigate("/", { replace: true });
      })
      .catch(() => navigate("/", { replace: true }));
  }, [navigate]);

  const refreshPendingCount = usePendingAthleteLinksStore((s) => s.refresh);

  useEffect(() => {
    athletesApi.list().then(setAthletes);
    // A lista acabou de ser lida: alinha o selo do menu com ela.
    void refreshPendingCount(true);
  }, [refreshPendingCount]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleConfirmRemove() {
    if (!removing) return;
    await athletesApi.remove(removing.id);
    setAthletes((prev) => (prev ?? []).filter((a) => a.id !== removing.id));
    void refreshPendingCount(true);
  }

  async function handleConfirmLink(id: string) {
    setConfirming(id);
    try {
      const updated = await athletesApi.confirm(id);
      setAthletes((prev) => (prev ?? []).map((a) => (a.id === id ? updated : a)));
      void refreshPendingCount(true);
    } finally {
      setConfirming(null);
    }
  }

  return (
    <div className="flex h-dvh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      <main className="relative flex-1 overflow-y-auto pt-14 sm:pt-0">
        <PageLoadingOverlay loading={athletes === null} />
        <div className="grid w-full grid-cols-[minmax(0,1fr)] px-4 py-6 sm:px-10 sm:py-10 lg:px-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-foreground">Gerenciar atletas</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Seu elenco. Quem tem vínculo confirmado enxerga as próprias notas em todos os
                  eventos do seu programa.
                </p>
              </div>
            </div>

            <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
              <Plus data-icon="inline-start" />
              Adicionar atleta
            </Button>
          </div>

          <div className="mt-6 rounded-lg border border-border/60 bg-card">
            <div className="divide-y divide-border/60">
              {(athletes ?? []).map((athlete) => {
                // No celular o selo/botão de vínculo desce pra uma linha
                // própria (alinhada ao nome); ao lado, espremia o nome.
                const linkStatus = athlete.emailIsProgramAccount ? null : athlete.confirmed ? (
                  <Badge
                    variant="outline"
                    className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  >
                    <CheckCircle2 className="size-3" data-icon="inline-start" />
                    Confirmado
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={confirming === athlete.id}
                    onClick={() => void handleConfirmLink(athlete.id)}
                  >
                    {confirming === athlete.id ? "Confirmando..." : "Confirmar vínculo"}
                  </Button>
                );
                return (
                <div key={athlete.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      style={{ backgroundColor: getAvatarColor(athlete.id) }}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    >
                      {getInitials(athlete.firstName, athlete.lastName)}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
                        <span className="min-w-0 truncate">
                          {athlete.firstName} {athlete.lastName}
                        </span>
                        {!athlete.hasAccount && !athlete.emailIsProgramAccount && (
                          <Badge
                            variant="outline"
                            className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          >
                            Aguardando cadastro
                          </Badge>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{athlete.email}</p>
                      {athlete.requestedFromEvent && !athlete.confirmed && (
                        <p className="text-xs text-muted-foreground">
                          Adicionado pelo produtor do evento {athlete.requestedFromEvent}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {linkStatus && <div className="hidden sm:block">{linkStatus}</div>}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setRemoving(athlete)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                {linkStatus && <div className="mt-2 pl-13 sm:hidden">{linkStatus}</div>}
                {/* Linha própria, na largura toda: ao lado do nome ficava
                    espremido numa coluna estreita no celular. */}
                {athlete.emailIsProgramAccount && (
                  <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    Uma conta Programa foi criada usando este e-mail, ele não poderá ser incluído como atleta deste
                    programa.
                  </p>
                )}
                </div>
                );
              })}

              {athletes !== null && athletes.length === 0 && (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum atleta cadastrado ainda.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      <CreateAthleteDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(athlete) => setAthletes((prev) => [athlete, ...(prev ?? [])])}
      />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remover atleta do elenco"
        description={
          removing
            ? `${removing.firstName} ${removing.lastName} será removido do seu elenco. O usuário continuará tendo acesso aos eventos já iniciados ou concluídos na época em que o vínculo dele esteve ativo com o programa.`
            : ""
        }
        confirmLabel="Remover"
        confirmingLabel="Removendo..."
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}

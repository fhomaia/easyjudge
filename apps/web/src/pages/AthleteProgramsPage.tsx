import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CheckCircle2, Clock, Plus } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RequestProgramLinkDialog } from "@/components/RequestProgramLinkDialog";
import { athleteProgramsApi, usersApi, type AthleteLinkView, type UserProfile } from "@/api/client";
import { useAuthStore } from "@/store/auth";

// "Meus programas" do PRÓPRIO atleta logado — o primeiro vínculo é
// pedido no cadastro; esta tela é pra pedir mais (um atleta pode ter
// vários programas ao longo do tempo). Confirmado = já vê Notas em
// todo evento daquele programa; pendente = já enxerga os eventos como
// espectador (Início/Cronograma/Resultados), mas Notas continua
// bloqueado até o programa confirmar.
export function AthleteProgramsPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [links, setLinks] = useState<AthleteLinkView[] | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  useEffect(() => {
    usersApi
      .me()
      .then((p) => {
        setProfile(p);
        if (p.role !== "athlete") navigate("/", { replace: true });
      })
      .catch(() => navigate("/", { replace: true }));
  }, [navigate]);

  useEffect(() => {
    athleteProgramsApi.list().then(setLinks);
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-svh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto pt-14 sm:pt-0">
        <div className="mx-auto max-w-3xl px-6 py-10 sm:px-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Meus programas</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Os programas aos quais você está vinculado.
                </p>
              </div>
            </div>

            <Button onClick={() => setRequestOpen(true)}>
              <Plus data-icon="inline-start" />
              Vincular a um programa
            </Button>
          </div>

          <div className="mt-6 rounded-lg border border-border/60 bg-card">
            <div className="divide-y divide-border/60">
              {(links ?? []).map((link) => (
                <div key={link.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {link.programEmail}
                    </p>
                    {!link.programResolved && (
                      <p className="truncate text-xs text-muted-foreground">
                        Aguardando esse programa se cadastrar na plataforma.
                      </p>
                    )}
                  </div>

                  {link.confirmed ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    >
                      <CheckCircle2 className="size-3" data-icon="inline-start" />
                      Confirmado
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    >
                      <Clock className="size-3" data-icon="inline-start" />
                      Aguardando confirmação
                    </Badge>
                  )}
                </div>
              ))}

              {links !== null && links.length === 0 && (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum programa vinculado ainda.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      <RequestProgramLinkDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        onCreated={(link) => setLinks((prev) => [link, ...(prev ?? [])])}
      />
    </div>
  );
}

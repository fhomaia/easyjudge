import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { PageLoadingOverlay } from "@/components/PageLoadingOverlay";
import { useNotificationsUnreadCount } from "@/lib/useNotificationsUnreadCount";
import { useEventSetupGuard } from "@/lib/useEventSetupGuard";
import { useAuthStore } from "@/store/auth";
import { usersApi, type UserProfile } from "@/api/client";

interface ProgramsSetupShellProps {
  loading: boolean;
  backLabel: string;
  backTo: string;
  // Conteúdo ocupa pelo menos a altura da tela, pra a página poder
  // empurrar um bloco pro fim com `mt-auto` (banner "Próxima etapa
  // recomendada" da lista de programas).
  fillHeight?: boolean;
  children: ReactNode;
}

// Casca das telas de Inscrições (lista, programa, equipe): mesmo
// layout das outras telas de etapa do Setup.
export function ProgramsSetupShell({
  loading,
  backLabel,
  backTo,
  fillHeight,
  children,
}: ProgramsSetupShellProps) {
  const { id } = useParams<{ id: string }>();
  useEventSetupGuard(id);
  const notificationsUnreadCount = useNotificationsUnreadCount(id);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-dvh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      {/* `pt-14 sm:pt-0`: espaço da barra fixa do AppSidebar no celular. */}
      <main
        className={`relative flex-1 overflow-y-auto pt-14 sm:pt-0 ${fillHeight ? "flex flex-col" : ""}`}
      >
        <PageLoadingOverlay loading={loading} />
        <div className="flex items-center justify-between px-4 pt-6 sm:px-10">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </button>
          <NotificationBell unreadCount={notificationsUnreadCount} />
        </div>

        <div
          className={`px-4 pb-10 sm:px-10 ${fillHeight ? "flex min-w-0 flex-1 flex-col" : ""}`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

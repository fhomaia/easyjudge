import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { PageLoadingOverlay } from "@/components/PageLoadingOverlay";
import { FeedbackOverview } from "@/components/FeedbackOverview";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { IMPERSONATOR_EMAIL } from "@/lib/impersonation";
import {
  feedbackApi,
  usersApi,
  type FeedbackSummary,
  type PlatformFeedbackItem,
  type UserProfile,
  type UserRole,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

// Avaliações da Cheer Cup (plataforma) — só pro dono da plataforma
// (mesma exceção fixa do "ver como", IMPERSONATOR_EMAIL; o backend
// também barra os demais com 403).
export function PlatformFeedbackPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [data, setData] = useState<{ summary: FeedbackSummary; items: PlatformFeedbackItem[] } | null>(null);

  useEffect(() => {
    usersApi
      .me()
      .then((me) => {
        if (me.email.toLowerCase() !== IMPERSONATOR_EMAIL) {
          navigate("/", { replace: true });
          return;
        }
        setProfile(me);
        return feedbackApi.listPlatform().then(setData);
      })
      .catch(() => navigate("/", { replace: true }));
  }, [navigate]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-dvh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />
      <main className="relative flex-1 overflow-y-auto pt-14 sm:pt-0">
        <PageLoadingOverlay loading={data === null} />
        <div className="w-full max-w-3xl px-4 py-8 sm:px-10">
          <h1 className="text-2xl font-semibold text-foreground">Avaliações da Cheer Cup</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            O que as pessoas acham da plataforma (não de um evento específico).
          </p>
          {data && (
            <FeedbackOverview
              summary={data.summary}
              emptyMessage="Ninguém avaliou a plataforma ainda."
              items={data.items.map((item) => ({
                id: item.id,
                name: item.userName,
                details: [
                  item.userEmail,
                  ROLE_LABELS[item.userRole as UserRole] ?? item.userRole,
                  item.page ? `tela ${item.page}` : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
                rating: item.rating,
                comment: item.comment,
                date: item.createdAt,
              }))}
            />
          )}
        </div>
      </main>
    </div>
  );
}

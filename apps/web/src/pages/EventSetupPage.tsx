import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppSidebar, type SidebarSection } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { SetupProgressSummary } from "@/components/SetupProgressSummary";
import { SetupStepCard } from "@/components/SetupStepCard";
import { SetupRecommendedBanner } from "@/components/SetupRecommendedBanner";
import { buildSetupSteps } from "@/lib/eventSetupSteps";
import { ApiError, eventsApi, usersApi, type Event, type UserProfile } from "@/api/client";
import { useAuthStore } from "@/store/auth";

export function EventSetupPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [activeSection, setActiveSection] = useState<SidebarSection>("events");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    eventsApi
      .get(id)
      .then(setEvent)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Não foi possível carregar o evento.",
        ),
      );
  }, [id]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function handleSelectSection(section: SidebarSection) {
    setActiveSection(section);
    navigate("/");
  }

  const steps = event ? buildSetupSteps(event) : [];
  const firstIncomplete = steps.find((s) => !s.completed);

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
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar para eventos
          </button>
          <NotificationBell />
        </div>

        <div className="px-10 pb-10">
          {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

          {event && (
            <div className="grid gap-6">
              <div>
                <h1 className="mt-4 text-2xl font-semibold text-foreground">
                  Configuração do evento
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Prepare &quot;{event.name}&quot; em 3 etapas. Você pode iniciá-las em qualquer
                  ordem, mas recomendamos seguir a sequência para facilitar o processo.
                </p>
              </div>

              <SetupProgressSummary steps={steps} />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {steps.map((step, index) => (
                  <SetupStepCard
                    key={step.key}
                    step={step}
                    stepNumber={index + 1}
                    recommended={index === 0}
                  />
                ))}
              </div>

              {firstIncomplete && <SetupRecommendedBanner step={firstIncomplete} />}

              <p className="text-center text-sm text-muted-foreground">
                💡 Você pode salvar e sair a qualquer momento. Suas informações ficam seguras e
                podem ser editadas depois.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

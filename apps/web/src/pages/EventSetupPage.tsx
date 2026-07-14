import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { SetupProgressSummary } from "@/components/SetupProgressSummary";
import { SetupStepCard } from "@/components/SetupStepCard";
import { SetupRecommendedBanner } from "@/components/SetupRecommendedBanner";
import { buildSetupSteps, type RegulationSummary } from "@/lib/eventSetupSteps";
import {
  ApiError,
  eventsApi,
  regulationApi,
  scoringTemplatesApi,
  usersApi,
  type Event,
  type Regulation,
  type ScoringTemplate,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

export function EventSetupPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [regulation, setRegulation] = useState<Regulation | null>(null);
  const [templates, setTemplates] = useState<ScoringTemplate[] | null>(null);
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
    regulationApi.get(id).then(setRegulation).catch(() => setRegulation(null));
    scoringTemplatesApi.list().then(setTemplates).catch(() => setTemplates([]));
  }, [id]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const regulationSummary: RegulationSummary | null = regulation
    ? {
        hasOfficialRegulation: regulation.documents.some(
          (d) => d.kind === "official_regulation",
        ),
        hasSafetyRules: regulation.documents.some((d) => d.kind === "safety_rules"),
        hasCompleteTemplate: (templates ?? []).some(
          (t) => (t.distributedScore ?? 0) === t.targetScore,
        ),
        updatedAt: regulation.updatedAt,
      }
    : null;

  const steps = event ? buildSetupSteps(event, regulationSummary) : [];
  const firstIncomplete = steps.find((s) => !s.completed);

  return (
    <div className="flex h-svh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

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
                  Prepare &quot;{event.name}&quot; em {steps.length} etapas. Você pode
                  iniciá-las em qualquer ordem, mas recomendamos seguir a sequência para
                  facilitar o processo.
                </p>
              </div>

              <SetupProgressSummary steps={steps} />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {steps.map((step, index) => (
                  <SetupStepCard
                    key={step.key}
                    step={step}
                    stepNumber={index + 1}
                    recommended={step.key === firstIncomplete?.key}
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

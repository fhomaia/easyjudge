import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, UserCog } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { SetupProgressSummary } from "@/components/SetupProgressSummary";
import { SetupStepCard } from "@/components/SetupStepCard";
import { SetupRecommendedBanner } from "@/components/SetupRecommendedBanner";
import { PublishEventCard } from "@/components/PublishEventCard";
import { PublishCelebrationOverlay } from "@/components/PublishCelebrationOverlay";
import { buildSetupSteps, type RegulationSummary, type ScheduleSummary } from "@/lib/eventSetupSteps";
import { useEventSetupGuard } from "@/lib/useEventSetupGuard";
import {
  fetchTemplateJudgingStats,
  isTemplateJudgingComplete,
} from "@/lib/templateJudgingProgress";
import {
  ApiError,
  categoriesApi,
  eventsApi,
  judgesApi,
  judgingApi,
  regulationApi,
  scheduleApi,
  scoringTemplatesApi,
  usersApi,
  type Category,
  type Event,
  type Regulation,
  type ScheduleDay,
  type ScoringTemplate,
  type UnscheduledPair,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

export function EventSetupPage() {
  const { id } = useParams<{ id: string }>();
  useEventSetupGuard(id);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [regulation, setRegulation] = useState<Regulation | null>(null);
  const [templates, setTemplates] = useState<ScoringTemplate[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hasLegalityJudge, setHasLegalityJudge] = useState(false);
  const [hasAnyJudge, setHasAnyJudge] = useState(false);
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([]);
  const [unscheduledByDay, setUnscheduledByDay] = useState<Map<string, UnscheduledPair[]>>(
    new Map(),
  );
  const [templateStats, setTemplateStats] = useState<
    Map<string, { total: number; assigned: number }>
  >(new Map());
  const [error, setError] = useState<string | null>(null);
  const [publishCelebrationOpen, setPublishCelebrationOpen] = useState(false);

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
    categoriesApi.list(id).then(setCategories).catch(() => setCategories([]));
    judgesApi
      .list(id)
      .then((judges) => setHasAnyJudge(judges.length > 0))
      .catch(() => setHasAnyJudge(false));
    scheduleApi.listDays(id).then(setScheduleDays).catch(() => setScheduleDays([]));
  }, [id]);

  // Jurado de Legalidade agora é por RECURSO (2026-07-19 — mesma razão
  // da árvore de critérios: um jurado não pode estar em duas pistas ao
  // mesmo tempo) — só considera preenchido quando TODO recurso que já
  // tem apresentação agendada, em TODOS os dias do cronograma, tem um
  // jurado de legalidade definido (mesmo raciocínio já usado pra
  // "sistema de pontuação completo": um recurso sem essa função ainda
  // é uma pendência real, não dá pra contar como resolvido só porque
  // outro já tem). **Gotcha corrigido**: filtrar só por
  // `supportsPresentations` contava recursos que aceitam apresentação
  // mas ainda não têm NENHUMA agendada (ex: "Pista 1" de um dia sem
  // apresentações ainda) — esses recursos nunca aparecem como coluna
  // no painel de jurados (ver JudgingService.
  // findResourcesWithScheduledCategories, que só lista recursos com
  // apresentação de verdade), então essa etapa nunca fechava mesmo com
  // tudo que o usuário conseguia ver preenchido. Agora só conta
  // recurso que já tem pelo menos uma entry `presentation`.
  useEffect(() => {
    const resourceIds = scheduleDays.flatMap((day) =>
      day.resources
        .filter((r) => r.supportsPresentations && r.entries.some((e) => e.type === "presentation"))
        .map((r) => r.id),
    );
    if (!id || resourceIds.length === 0) {
      setHasLegalityJudge(false);
      return;
    }
    let cancelled = false;
    Promise.all(resourceIds.map((resourceId) => judgingApi.getSpecialRoles(id, resourceId)))
      .then((allRoles) => {
        if (cancelled) return;
        const complete = allRoles.every(
          (roles) => (roles.find((r) => r.role === "legality_judge")?.judgeIds.length ?? 0) > 0,
        );
        setHasLegalityJudge(complete);
      })
      .catch(() => setHasLegalityJudge(false));
    return () => {
      cancelled = true;
    };
  }, [id, scheduleDays]);

  // "Não agendadas" é por dia (ver ScheduleService — cada equipe/
  // categoria se apresenta uma vez em CADA dia, não uma vez só no
  // evento) — busca a lista de pendências de CADA dia (não só de um
  // representante), porque a flag "ignorar apresentações não
  // agendadas" (ver ScheduleDay.ignoreUnscheduledPresentations) pode
  // estar marcada só nalguns dias, então precisa saber a pendência de
  // cada um individualmente pra decidir o que conta ou não.
  useEffect(() => {
    if (!id || scheduleDays.length === 0) {
      setUnscheduledByDay(new Map());
      return;
    }
    let cancelled = false;
    Promise.all(
      scheduleDays.map((day) =>
        scheduleApi
          .getUnscheduled(id, day.id)
          .then((pairs): [string, UnscheduledPair[]] => [day.id, pairs])
          .catch((): [string, UnscheduledPair[]] => [day.id, []]),
      ),
    ).then((entries) => {
      if (!cancelled) setUnscheduledByDay(new Map(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [id, scheduleDays]);

  // Templates de pontuação em uso por alguma categoria do evento —
  // mesma derivação de JudgingPage. A escala de arbitragem só conta
  // como concluída na página de setup quando TODOS eles estão 100%
  // cobertos (todo item de avaliação com jurado atribuído).
  const judgingTemplateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const category of categories) {
      if (category.scoringTemplate) ids.add(category.scoringTemplate.id);
    }
    return Array.from(ids);
  }, [categories]);

  useEffect(() => {
    if (!id || judgingTemplateIds.length === 0) {
      setTemplateStats(new Map());
      return;
    }
    let cancelled = false;
    fetchTemplateJudgingStats(id, judgingTemplateIds).then((stats) => {
      if (!cancelled) setTemplateStats(stats);
    });
    return () => {
      cancelled = true;
    };
  }, [id, judgingTemplateIds]);

  // Um template sem nenhuma apresentação agendada (`total === 0`, ver
  // fetchTemplateJudgingStats) não tem em qual dia/recurso escalar
  // jurado ainda — não deveria ser exigido pra fechar esta etapa
  // (mesmo filtro usado no seletor de template da JudgingPage).
  const relevantJudgingTemplateIds = useMemo(
    () => judgingTemplateIds.filter((templateId) => (templateStats.get(templateId)?.total ?? 0) > 0),
    [judgingTemplateIds, templateStats],
  );

  const allTemplatesJudgingComplete =
    relevantJudgingTemplateIds.length > 0 &&
    relevantJudgingTemplateIds.every((templateId) =>
      isTemplateJudgingComplete(templateStats.get(templateId)),
    );

  // "Componente" de verdade (Almoço, Contestação de notas, Abertura,
  // Premiação, intervalo personalizado) — não os intervalos
  // "Aguardando aquecimento"/"Aguardando disponibilidade da equipe" que
  // o próprio agendamento de uma apresentação insere sozinho (esses têm
  // linkedEntryId, ver ScheduleService).
  //
  // Cada equipe/categoria precisa de uma apresentação em CADA dia do
  // evento (não uma vez só) — o total esperado é a soma, por dia, do
  // que já está agendado + o que falta agendar naquele dia
  // especificamente (via `unscheduledByDay`). Um dia com
  // `ignoreUnscheduledPresentations` marcado não conta suas pendências
  // pra esse total — na prática, "zera" a contribuição daquele dia
  // pro contador de pendências do evento inteiro.
  const scheduleSummary: ScheduleSummary = useMemo(() => {
    let scheduledPresentationsTotal = 0;
    let unscheduledCount = 0;
    let hasScheduledComponent = false;
    let latestUpdatedAt: string | null = null;
    for (const day of scheduleDays) {
      if (!latestUpdatedAt || day.updatedAt > latestUpdatedAt) latestUpdatedAt = day.updatedAt;
      for (const resource of day.resources) {
        for (const entry of resource.entries) {
          if (entry.type === "presentation") {
            scheduledPresentationsTotal++;
          }
          if (
            (entry.type === "break" || entry.type === "ceremony" || entry.type === "award") &&
            !entry.linkedEntryId
          ) {
            hasScheduledComponent = true;
          }
          if (!latestUpdatedAt || entry.updatedAt > latestUpdatedAt) latestUpdatedAt = entry.updatedAt;
        }
      }
      if (!day.ignoreUnscheduledPresentations) {
        unscheduledCount += unscheduledByDay.get(day.id)?.length ?? 0;
      }
    }
    return {
      totalPairs: scheduledPresentationsTotal + unscheduledCount,
      unscheduledCount,
      hasScheduledPresentation: scheduledPresentationsTotal > 0,
      hasScheduledComponent,
      updatedAt: latestUpdatedAt,
    };
  }, [scheduleDays, unscheduledByDay]);

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
        hasCompleteTemplate: (templates ?? []).some((t) => t.isComplete),
        updatedAt: regulation.updatedAt,
      }
    : null;

  const steps = event
    ? buildSetupSteps(
        event,
        regulationSummary,
        hasLegalityJudge,
        allTemplatesJudgingComplete,
        hasAnyJudge,
        scheduleSummary,
      )
    : [];
  const firstIncomplete = steps.find((s) => !s.completed);
  const allStepsCompleted = steps.length > 0 && steps.every((s) => s.completed);

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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="mt-4 text-2xl font-semibold text-foreground">
                    Configuração do evento
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Prepare &quot;{event.name}&quot; em {steps.length + 1} etapas. Você pode
                    iniciá-las em qualquer ordem, mas recomendamos seguir a sequência para
                    facilitar o processo.
                  </p>
                </div>

                {(event.currentUserRoles.includes("admin") ||
                  event.currentUserRoles.includes("assessor")) && (
                  <Button
                    variant="outline"
                    className="mt-4 shrink-0"
                    onClick={() => navigate(`/events/${id}/access`)}
                  >
                    <UserCog data-icon="inline-start" />
                    Gerenciar acessos
                  </Button>
                )}
              </div>

              <SetupProgressSummary steps={steps} published={event.status !== "created"} />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {steps.map((step, index) => (
                  <SetupStepCard
                    key={step.key}
                    step={step}
                    stepNumber={index + 1}
                    recommended={step.key === firstIncomplete?.key}
                  />
                ))}

                <PublishEventCard
                  event={event}
                  stepNumber={steps.length + 1}
                  allStepsCompleted={allStepsCompleted}
                  onPublished={(updated) => {
                    setEvent(updated);
                    setPublishCelebrationOpen(true);
                  }}
                />
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

      <PublishCelebrationOverlay
        open={publishCelebrationOpen}
        onGoHome={() => navigate("/")}
      />
    </div>
  );
}

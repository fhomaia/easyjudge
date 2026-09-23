import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Eye,
  Gavel,
  Layers,
  PersonStanding,
  PlaySquare,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PageLoadingOverlay } from "@/components/PageLoadingOverlay";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { MetricBarList } from "@/components/MetricBarList";
import { useNotificationsUnreadCount } from "@/lib/useNotificationsUnreadCount";
import { useEventSetupGuard } from "@/lib/useEventSetupGuard";
import { autoFormatKeyLabel } from "@/lib/autoFormatKey";
import {
  eventsApi,
  eventMetricsApi,
  usersApi,
  type Event,
  type EventMetricsResponse,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

// Tela dedicada de métricas gerais do evento (2026-09-23, a pedido do
// usuário) — só admin/assessor (useEventSetupGuard, mesmo gate de
// EventHistoryPage/EventStaffPage). Alcançada só pelo menu "⋯" da
// listagem de eventos (ver EventActionsMenu). Puramente leitura
// agregada, sem dado sensível por pessoa (só contagens).
export function EventMetricsPage() {
  const { id } = useParams<{ id: string }>();
  const notificationsUnreadCount = useNotificationsUnreadCount(id);
  useEventSetupGuard(id);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [metrics, setMetrics] = useState<EventMetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then(setEvent).catch(() => setEvent(null));
    eventMetricsApi
      .get(id)
      .then(setMetrics)
      .catch(() => setError("Não foi possível carregar as métricas do evento."));
  }, [id]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-svh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      <main className="relative flex-1 overflow-y-auto">
        <PageLoadingOverlay loading={(!event || !metrics) && !error} />
        <div className="flex items-center justify-between px-10 pt-6">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar para eventos
          </button>
          <NotificationBell unreadCount={notificationsUnreadCount} />
        </div>

        <div className="px-10 pb-10">
          <div className="mt-6 flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Métricas do evento</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {event ? event.name : "Carregando..."}
              </p>
            </div>
          </div>

          {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

          {metrics && (
            <div className="mt-6 flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                <StatTile icon={Layers} label="Categorias" value={metrics.categoriesCount} />
                <StatTile icon={Users} label="Equipes" value={metrics.teamsCount} />
                <StatTile icon={Building2} label="Programas" value={metrics.programsCount} />
                <StatTile
                  icon={PlaySquare}
                  label="Apresentações"
                  value={metrics.presentationsCount}
                />
                <StatTile icon={Gavel} label="Jurados" value={metrics.judgesCount} />
                <StatTile
                  icon={PersonStanding}
                  label="Atletas"
                  value={metrics.athletesCount}
                />
                <StatTile icon={Eye} label="Espectadores" value={metrics.spectatorsCount} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard title="Equipes por programa">
                  <MetricBarList items={metrics.teamsByProgram} />
                </ChartCard>
                <ChartCard title="Apresentações por categoria">
                  <MetricBarList items={metrics.presentationsByCategory} />
                </ChartCard>
                <ChartCard title="Categorias por modalidade">
                  <MetricBarList
                    items={metrics.categoriesByFormat.map((f) => ({
                      label: autoFormatKeyLabel(f.formatKey),
                      count: f.count,
                    }))}
                  />
                </ChartCard>
                <ChartCard title="Origem dos programas (UF)">
                  <MetricBarList items={metrics.programsByState} />
                </ChartCard>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GuestRoute } from "@/components/GuestRoute";
import { RouteLoadingFallback } from "@/components/RouteLoadingFallback";
import { UploadStatusBanner } from "@/components/UploadStatusBanner";

const HomePage = lazy(() =>
  import("@/pages/HomePage").then((m) => ({ default: m.HomePage })),
);
const EventSetupPage = lazy(() =>
  import("@/pages/EventSetupPage").then((m) => ({ default: m.EventSetupPage })),
);
const EventLiveDashboardPage = lazy(() =>
  import("@/pages/EventLiveDashboardPage").then((m) => ({
    default: m.EventLiveDashboardPage,
  })),
);
const EventLiveSchedulePage = lazy(() =>
  import("@/pages/EventLiveSchedulePage").then((m) => ({
    default: m.EventLiveSchedulePage,
  })),
);
const EventLiveNotesPage = lazy(() =>
  import("@/pages/EventLiveNotesPage").then((m) => ({
    default: m.EventLiveNotesPage,
  })),
);
const EventLiveResultsPage = lazy(() =>
  import("@/pages/EventLiveResultsPage").then((m) => ({
    default: m.EventLiveResultsPage,
  })),
);
const EventLiveNotificationsPage = lazy(() =>
  import("@/pages/EventLiveNotificationsPage").then((m) => ({
    default: m.EventLiveNotificationsPage,
  })),
);
const EventLiveScoringPage = lazy(() =>
  import("@/pages/EventLiveScoringPage").then((m) => ({
    default: m.EventLiveScoringPage,
  })),
);
const EventLiveTeamNotesPage = lazy(() =>
  import("@/pages/EventLiveTeamNotesPage").then((m) => ({
    default: m.EventLiveTeamNotesPage,
  })),
);
const EventStaffPage = lazy(() =>
  import("@/pages/EventStaffPage").then((m) => ({ default: m.EventStaffPage })),
);
const EventHistoryPage = lazy(() =>
  import("@/pages/EventHistoryPage").then((m) => ({
    default: m.EventHistoryPage,
  })),
);
const RegulationPage = lazy(() =>
  import("@/pages/RegulationPage").then((m) => ({ default: m.RegulationPage })),
);
const CategoriesPage = lazy(() =>
  import("@/pages/CategoriesPage").then((m) => ({ default: m.CategoriesPage })),
);
const ProgramsPage = lazy(() =>
  import("@/pages/ProgramsPage").then((m) => ({ default: m.ProgramsPage })),
);
const JudgingPage = lazy(() =>
  import("@/pages/JudgingPage").then((m) => ({ default: m.JudgingPage })),
);
const SchedulePage = lazy(() =>
  import("@/pages/SchedulePage").then((m) => ({ default: m.SchedulePage })),
);
const ScoringTemplatesListPage = lazy(() =>
  import("@/pages/ScoringTemplatesListPage").then((m) => ({
    default: m.ScoringTemplatesListPage,
  })),
);
const ScoringTemplateBuilderPage = lazy(() =>
  import("@/pages/ScoringTemplateBuilderPage").then((m) => ({
    default: m.ScoringTemplateBuilderPage,
  })),
);
const AthletesManagementPage = lazy(() =>
  import("@/pages/AthletesManagementPage").then((m) => ({
    default: m.AthletesManagementPage,
  })),
);
const AthleteProgramsPage = lazy(() =>
  import("@/pages/AthleteProgramsPage").then((m) => ({
    default: m.AthleteProgramsPage,
  })),
);
const ProfilePage = lazy(() =>
  import("@/pages/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);
const JoinEventPage = lazy(() =>
  import("@/pages/JoinEventPage").then((m) => ({ default: m.JoinEventPage })),
);
const TermsOfUsePage = lazy(() =>
  import("@/pages/TermsOfUsePage").then((m) => ({ default: m.TermsOfUsePage })),
);
const PrivacyPolicyPage = lazy(() =>
  import("@/pages/PrivacyPolicyPage").then((m) => ({
    default: m.PrivacyPolicyPage,
  })),
);

function App() {
  return (
    <>
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* Fora de GuestRoute/ProtectedRoute de propósito — precisa
          funcionar logado ou deslogado (ver JoinEventPage). Mesmo
          raciocínio pra /terms e /privacy: linkadas de dentro do popup
          de cadastro (deslogado), mas devem continuar acessíveis por
          quem já tem conta. */}
        <Route path="/join/:code" element={<JoinEventPage />} />
        <Route path="/terms" element={<TermsOfUsePage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/events/:id/setup" element={<EventSetupPage />} />
          <Route path="/events/:id/live" element={<EventLiveDashboardPage />} />
          <Route
            path="/events/:id/live/schedule"
            element={<EventLiveSchedulePage />}
          />
          <Route
            path="/events/:id/live/notes"
            element={<EventLiveNotesPage />}
          />
          <Route
            path="/events/:id/live/results"
            element={<EventLiveResultsPage />}
          />
          <Route
            path="/events/:id/live/notifications"
            element={<EventLiveNotificationsPage />}
          />
          <Route
            path="/events/:id/live/scoring/:entryId"
            element={<EventLiveScoringPage />}
          />
          <Route
            path="/events/:id/live/team"
            element={<EventLiveTeamNotesPage />}
          />
          <Route path="/events/:id/access" element={<EventStaffPage />} />
          <Route path="/events/:id/history" element={<EventHistoryPage />} />
          <Route path="/events/:id/regulation" element={<RegulationPage />} />
          <Route path="/events/:id/categories" element={<CategoriesPage />} />
          <Route path="/events/:id/programs" element={<ProgramsPage />} />
          <Route path="/events/:id/judging" element={<JudgingPage />} />
          <Route path="/events/:id/schedule" element={<SchedulePage />} />
          <Route
            path="/scoring-templates"
            element={<ScoringTemplatesListPage />}
          />
          <Route
            path="/scoring-templates/:id"
            element={<ScoringTemplateBuilderPage />}
          />
          <Route path="/athletes" element={<AthletesManagementPage />} />
          <Route path="/athletes/programs" element={<AthleteProgramsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    <UploadStatusBanner />
    </>
  );
}

export default App;

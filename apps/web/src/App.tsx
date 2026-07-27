import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { HomePage } from "@/pages/HomePage";
import { EventSetupPage } from "@/pages/EventSetupPage";
import { EventLiveDashboardPage } from "@/pages/EventLiveDashboardPage";
import { EventLiveSchedulePage } from "@/pages/EventLiveSchedulePage";
import { EventLiveNotesPage } from "@/pages/EventLiveNotesPage";
import { EventLiveResultsPage } from "@/pages/EventLiveResultsPage";
import { EventLiveNotificationsPage } from "@/pages/EventLiveNotificationsPage";
import { EventLiveScoringPage } from "@/pages/EventLiveScoringPage";
import { EventLiveTeamNotesPage } from "@/pages/EventLiveTeamNotesPage";
import { EventStaffPage } from "@/pages/EventStaffPage";
import { EventHistoryPage } from "@/pages/EventHistoryPage";
import { RegulationPage } from "@/pages/RegulationPage";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { ProgramsPage } from "@/pages/ProgramsPage";
import { JudgingPage } from "@/pages/JudgingPage";
import { SchedulePage } from "@/pages/SchedulePage";
import { ScoringTemplatesListPage } from "@/pages/ScoringTemplatesListPage";
import { ScoringTemplateBuilderPage } from "@/pages/ScoringTemplateBuilderPage";
import { AthletesManagementPage } from "@/pages/AthletesManagementPage";
import { AthleteProgramsPage } from "@/pages/AthleteProgramsPage";
import { JoinEventPage } from "@/pages/JoinEventPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GuestRoute } from "@/components/GuestRoute";

function App() {
  return (
    <Routes>
      {/* Fora de GuestRoute/ProtectedRoute de propósito — precisa
          funcionar logado ou deslogado (ver JoinEventPage). */}
      <Route path="/join/:code" element={<JoinEventPage />} />
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/events/:id/setup" element={<EventSetupPage />} />
        <Route path="/events/:id/live" element={<EventLiveDashboardPage />} />
        <Route path="/events/:id/live/schedule" element={<EventLiveSchedulePage />} />
        <Route path="/events/:id/live/notes" element={<EventLiveNotesPage />} />
        <Route path="/events/:id/live/results" element={<EventLiveResultsPage />} />
        <Route path="/events/:id/live/notifications" element={<EventLiveNotificationsPage />} />
        <Route path="/events/:id/live/scoring/:entryId" element={<EventLiveScoringPage />} />
        <Route path="/events/:id/live/team" element={<EventLiveTeamNotesPage />} />
        <Route path="/events/:id/access" element={<EventStaffPage />} />
        <Route path="/events/:id/history" element={<EventHistoryPage />} />
        <Route path="/events/:id/regulation" element={<RegulationPage />} />
        <Route path="/events/:id/categories" element={<CategoriesPage />} />
        <Route path="/events/:id/programs" element={<ProgramsPage />} />
        <Route path="/events/:id/judging" element={<JudgingPage />} />
        <Route path="/events/:id/schedule" element={<SchedulePage />} />
        <Route path="/scoring-templates" element={<ScoringTemplatesListPage />} />
        <Route path="/scoring-templates/:id" element={<ScoringTemplateBuilderPage />} />
        <Route path="/athletes" element={<AthletesManagementPage />} />
        <Route path="/athletes/programs" element={<AthleteProgramsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

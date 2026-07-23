import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { HomePage } from "@/pages/HomePage";
import { EventSetupPage } from "@/pages/EventSetupPage";
import { EventLiveDashboardPage } from "@/pages/EventLiveDashboardPage";
import { EventLiveSchedulePage } from "@/pages/EventLiveSchedulePage";
import { EventStaffPage } from "@/pages/EventStaffPage";
import { RegulationPage } from "@/pages/RegulationPage";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { ProgramsPage } from "@/pages/ProgramsPage";
import { JudgingPage } from "@/pages/JudgingPage";
import { SchedulePage } from "@/pages/SchedulePage";
import { ScoringTemplatesListPage } from "@/pages/ScoringTemplatesListPage";
import { ScoringTemplateBuilderPage } from "@/pages/ScoringTemplateBuilderPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GuestRoute } from "@/components/GuestRoute";

function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/events/:id/setup" element={<EventSetupPage />} />
        <Route path="/events/:id/live" element={<EventLiveDashboardPage />} />
        <Route path="/events/:id/live/schedule" element={<EventLiveSchedulePage />} />
        <Route path="/events/:id/access" element={<EventStaffPage />} />
        <Route path="/events/:id/regulation" element={<RegulationPage />} />
        <Route path="/events/:id/categories" element={<CategoriesPage />} />
        <Route path="/events/:id/programs" element={<ProgramsPage />} />
        <Route path="/events/:id/judging" element={<JudgingPage />} />
        <Route path="/events/:id/schedule" element={<SchedulePage />} />
        <Route path="/scoring-templates" element={<ScoringTemplatesListPage />} />
        <Route path="/scoring-templates/:id" element={<ScoringTemplateBuilderPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

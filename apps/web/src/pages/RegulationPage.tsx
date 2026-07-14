import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { RegulationDocumentsSection } from "@/components/RegulationDocumentsSection";
import { DeductionRulesSection } from "@/components/DeductionRulesSection";
import { ScoringTemplatesSummarySection } from "@/components/ScoringTemplatesSummarySection";
import {
  ApiError,
  regulationApi,
  scoringTemplatesApi,
  usersApi,
  type DeductionType,
  type Regulation,
  type RegulationDocument,
  type RegulationDeductionMode,
  type RegulationDocumentKind,
  type ScoringTemplate,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

export function RegulationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [regulation, setRegulation] = useState<Regulation | null>(null);
  const [templates, setTemplates] = useState<ScoringTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    regulationApi
      .get(id)
      .then(setRegulation)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Não foi possível carregar o regulamento.",
        ),
      );
    scoringTemplatesApi.list().then(setTemplates).catch(() => setTemplates([]));
  }, [id]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleUploadDocument(kind: RegulationDocumentKind, file: File, name?: string) {
    if (!id) return;
    const updated = await regulationApi.uploadDocument(id, kind, file, name);
    setRegulation(updated);
  }

  async function handleDeleteDocument(document: RegulationDocument) {
    if (!id) return;
    await regulationApi.deleteDocument(id, document.id);
    setRegulation((prev) =>
      prev
        ? { ...prev, documents: prev.documents.filter((d) => d.id !== document.id) }
        : prev,
    );
  }

  async function handleModeChange(mode: RegulationDeductionMode) {
    if (!id) return;
    const updated = await regulationApi.updateDeductions(id, { deductionMode: mode });
    setRegulation(updated);
  }

  async function handleValueChange(type: DeductionType, value: number) {
    if (!id) return;
    const updated = await regulationApi.updateDeductions(id, {
      deductionValues: { [type]: value },
    });
    setRegulation(updated);
  }

  function handleTemplateCreated(template: ScoringTemplate) {
    navigate(`/scoring-templates/${template.id}`);
  }

  return (
    <div className="flex h-svh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-10 pt-6">
          <button
            type="button"
            onClick={() => navigate(`/events/${id}/setup`)}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar para configuração do evento
          </button>
          <NotificationBell />
        </div>

        <div className="px-10 pb-10">
          {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

          {regulation && templates !== null && (
            <div className="mt-6 grid gap-6">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h1 className="text-2xl font-semibold text-foreground">Regulamento</h1>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure os documentos e regras que serão utilizados no evento.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Alterações salvas automaticamente
                </p>
              </div>

              <RegulationDocumentsSection
                documents={regulation.documents}
                onUpload={handleUploadDocument}
                onDelete={handleDeleteDocument}
              />

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <DeductionRulesSection
                  deductionMode={regulation.deductionMode}
                  deductions={regulation.deductions}
                  onModeChange={handleModeChange}
                  onValueChange={handleValueChange}
                />

                <ScoringTemplatesSummarySection
                  templates={templates}
                  onCreated={handleTemplateCreated}
                />
              </div>

              <div className="flex flex-col gap-4 rounded-xl border border-amber-300/60 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-amber-400/20 dark:bg-amber-500/10">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400">
                    <Star className="size-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Próxima etapa recomendada</p>
                    <p className="text-sm text-muted-foreground">
                      Agora cadastre as categorias do evento. Durante esse processo você escolherá
                      qual sistema de pontuação será utilizado em cada categoria.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/events/${id}/categories`)}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  Ir para categorias
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

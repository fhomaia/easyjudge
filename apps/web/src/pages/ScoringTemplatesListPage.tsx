import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { CreateScoringTemplateDialog } from "@/components/CreateScoringTemplateDialog";
import { EditScoringTemplateDialog } from "@/components/EditScoringTemplateDialog";
import { ScoringTemplateCard } from "@/components/ScoringTemplateCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { listVariants } from "@/lib/motionVariants";
import {
  scoringTemplatesApi,
  usersApi,
  type ScoringTemplate,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

export function ScoringTemplatesListPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [templates, setTemplates] = useState<ScoringTemplate[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ScoringTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScoringTemplate | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
    scoringTemplatesApi.list().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function handleCreated(template: ScoringTemplate) {
    navigate(`/scoring-templates/${template.id}`);
  }

  function handleUpdated(template: ScoringTemplate) {
    setTemplates((prev) => prev?.map((t) => (t.id === template.id ? template : t)) ?? prev);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    await scoringTemplatesApi.remove(id);
    setTemplates((prev) => prev?.filter((t) => t.id !== id) ?? prev);
  }

  const hasAnyTemplates = (templates?.length ?? 0) > 0;

  return (
    <div className="flex h-svh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="flex justify-end px-10 pt-6">
          <NotificationBell />
        </div>

        <div className="px-10 pb-10">
          {templates !== null && (
            <div className="grid gap-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">Sistema de pontuação</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Crie templates reutilizáveis que definem como a pontuação é distribuída entre
                    as categorias.
                  </p>
                </div>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus data-icon="inline-start" />
                  Novo template
                </Button>
              </div>

              {hasAnyTemplates ? (
                <motion.div
                  variants={listVariants}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
                >
                  {templates.map((template) => (
                    <ScoringTemplateCard
                      key={template.id}
                      template={template}
                      onClick={() => navigate(`/scoring-templates/${template.id}`)}
                      onEdit={setEditTarget}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </motion.div>
              ) : (
                <div className="flex min-h-[40vh] items-center justify-center">
                  <Button size="lg" onClick={() => setCreateOpen(true)}>
                    <Plus data-icon="inline-start" />
                    Novo template
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <CreateScoringTemplateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />

      <EditScoringTemplateDialog
        template={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onUpdated={handleUpdated}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir template"
        description={`Tem certeza que quer excluir "${deleteTarget?.name}"? Todos os ${deleteTarget?.criteriaCount ?? 0} critérios dele também serão apagados. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        confirmingLabel="Excluindo..."
        onConfirm={handleDelete}
      />
    </div>
  );
}

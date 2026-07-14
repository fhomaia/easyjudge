import { useState } from "react";
import { RegulationDocumentSlotCard } from "@/components/RegulationDocumentSlotCard";
import { RegulationAdditionalDocuments } from "@/components/RegulationAdditionalDocuments";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { RegulationDocument, RegulationDocumentKind } from "@/api/client";

interface RegulationDocumentsSectionProps {
  documents: RegulationDocument[];
  onUpload: (kind: RegulationDocumentKind, file: File, name?: string) => Promise<void>;
  onDelete: (document: RegulationDocument) => Promise<void>;
}

const SLOTS: { kind: RegulationDocumentKind; label: string; required?: boolean }[] = [
  { kind: "official_regulation", label: "Regulamento oficial", required: true },
  { kind: "safety_rules", label: "Regras de segurança", required: true },
];

export function RegulationDocumentsSection({
  documents,
  onUpload,
  onDelete,
}: RegulationDocumentsSectionProps) {
  const [deleteTarget, setDeleteTarget] = useState<RegulationDocument | null>(null);

  const additionalDocuments = documents.filter((d) => d.kind === "additional");

  return (
    <div className="grid gap-4 rounded-lg border border-border/60 bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">1. Documentos do evento</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Faça upload dos documentos oficiais que compõem o regulamento do evento.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SLOTS.map((slot) => (
          <RegulationDocumentSlotCard
            key={slot.kind}
            kind={slot.kind}
            label={slot.label}
            required={slot.required}
            document={documents.find((d) => d.kind === slot.kind)}
            onUpload={onUpload}
            onRequestDelete={setDeleteTarget}
          />
        ))}
      </div>

      <RegulationAdditionalDocuments
        documents={additionalDocuments}
        onUpload={(file, name) => onUpload("additional", file, name)}
        onRequestDelete={setDeleteTarget}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir documento"
        description={`Tem certeza que quer excluir "${deleteTarget?.name}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        confirmingLabel="Excluindo..."
        onConfirm={async () => {
          if (deleteTarget) await onDelete(deleteTarget);
        }}
      />
    </div>
  );
}

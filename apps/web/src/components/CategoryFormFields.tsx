import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import {
  DIVISION_LABELS,
  FORMAT_LABELS,
  MODALITY_LABELS,
  isAlwaysNonTumbling,
} from "@/lib/categoryLabels";
import type {
  CategoryDivision,
  CategoryFormat,
  CategoryModality,
  ScoringTemplate,
} from "@/api/client";

// Campos compartilhados entre criar (em lote, por nível) e editar (uma
// categoria por vez) — nome e nível têm tratamento própria em cada tela
// (ver CreateCategoryDialog/EditCategoryDialog), por isso não entram aqui.
export interface CategorySharedFormValues {
  modality: CategoryModality;
  division: CategoryDivision;
  categoryFormat: CategoryFormat;
  customFormatLabel: string;
  nonTumbling: boolean;
  scoringTemplateId: string;
  presentationMinutes: string;
  presentationSeconds: string;
}

interface CategoryFormFieldsProps {
  form: CategorySharedFormValues;
  onChange: (key: keyof CategorySharedFormValues, value: string) => void;
  onToggleNonTumbling: (value: boolean) => void;
  // Só sistemas de pontuação "completos" (soma dos critérios-raiz ==
  // meta de pontos) podem ser atribuídos a uma categoria — a lista já
  // vem filtrada por quem chama (ver CategoriesPage).
  scoringTemplates: ScoringTemplate[];
}

export function CategoryFormFields({
  form,
  onChange,
  onToggleNonTumbling,
  scoringTemplates,
}: CategoryFormFieldsProps) {
  const navigate = useNavigate();

  return (
    <>
      <div className="grid gap-2">
        <Label>Formato</Label>
        <Select
          value={form.categoryFormat}
          onValueChange={(value) => onChange("categoryFormat", value as string)}
        >
          <SelectTrigger className="w-full">
            <SelectValue>{(value: CategoryFormat) => FORMAT_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FORMAT_LABELS) as CategoryFormat[]).map((key) => (
              <SelectItem key={key} value={key}>
                {FORMAT_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {form.categoryFormat === "custom" && (
        <div className="grid gap-2">
          <Label htmlFor="category-custom-format-label">Nome do formato</Label>
          <Input
            id="category-custom-format-label"
            placeholder="Ex.: Freestyle Pom"
            value={form.customFormatLabel}
            onChange={(e) => onChange("customFormatLabel", e.target.value)}
            required
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Modalidade</Label>
          <Select
            value={form.modality}
            onValueChange={(value) => onChange("modality", value as string)}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value: CategoryModality) => MODALITY_LABELS[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MODALITY_LABELS) as CategoryModality[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {MODALITY_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Divisão</Label>
          <Select
            value={form.division}
            onValueChange={(value) => onChange("division", value as string)}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value: CategoryDivision) => DIVISION_LABELS[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(DIVISION_LABELS) as CategoryDivision[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {DIVISION_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!isAlwaysNonTumbling(form.categoryFormat) && (
        <label className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={form.nonTumbling}
            onChange={(e) => onToggleNonTumbling(e.target.checked)}
            className="size-4 accent-primary"
          />
          Categoria non-tumbling
        </label>
      )}

      <div className="grid gap-2">
        <Label>Sistema de pontuação</Label>
        <Select
          value={form.scoringTemplateId || null}
          onValueChange={(value) => onChange("scoringTemplateId", value as string)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione um sistema de pontuação">
              {(value: string) => scoringTemplates.find((t) => t.id === value)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {scoringTemplates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {scoringTemplates.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhum sistema de pontuação completo disponível.{" "}
            <button
              type="button"
              onClick={() => navigate("/scoring-templates")}
              className="font-medium text-primary hover:underline"
            >
              Criar sistema de pontuação
            </button>
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="category-presentation-minutes">Tempo de apresentação</Label>
        <div className="flex items-center gap-2">
          <Input
            id="category-presentation-minutes"
            type="number"
            min={0}
            className="w-20"
            value={form.presentationMinutes}
            onChange={(e) => onChange("presentationMinutes", e.target.value)}
            aria-label="Minutos"
          />
          <span className="text-sm text-muted-foreground">min</span>
          <Input
            type="number"
            min={0}
            max={59}
            className="w-20"
            value={form.presentationSeconds}
            onChange={(e) => onChange("presentationSeconds", e.target.value)}
            aria-label="Segundos"
          />
          <span className="text-sm text-muted-foreground">seg</span>
        </div>
      </div>
    </>
  );
}

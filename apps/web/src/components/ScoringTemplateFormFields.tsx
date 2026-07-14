import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ScoringTemplateFormValues {
  name: string;
  description: string;
  targetScore: string;
}

interface ScoringTemplateFormFieldsProps {
  form: ScoringTemplateFormValues;
  onChange: (key: keyof ScoringTemplateFormValues, value: string) => void;
}

export function ScoringTemplateFormFields({ form, onChange }: ScoringTemplateFormFieldsProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="template-name">Nome do template</Label>
        <Input
          id="template-name"
          autoFocus
          value={form.name}
          onChange={(e) => onChange("name", e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="template-description">
          Descrição <span className="text-sm font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="template-description"
          value={form.description}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="template-target-score">Meta de pontos</Label>
        <Input
          id="template-target-score"
          type="number"
          min={0}
          value={form.targetScore}
          onChange={(e) => onChange("targetScore", e.target.value)}
        />
      </div>
    </>
  );
}

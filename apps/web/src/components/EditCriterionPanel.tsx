import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  scoringCriteriaApi,
  type ScoringCriterion,
  type ScoringCriterionType,
  type UpdateScoringCriterionPayload,
} from "@/api/client";

const TYPE_LABELS: Record<ScoringCriterionType, string> = {
  group: "Grupo (contém subitens)",
  score_item: "Item de avaliação",
};

const DEBOUNCE_MS = 600;

interface EditCriterionPanelProps {
  templateId: string;
  criterion: ScoringCriterion | null;
  hasChildren: boolean;
  onUpdated: (criterion: ScoringCriterion) => void;
  onRequestDelete: (criterion: ScoringCriterion) => void;
}

export function EditCriterionPanel({
  templateId,
  criterion,
  hasChildren,
  onUpdated,
  onRequestDelete,
}: EditCriterionPanelProps) {
  const [name, setName] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Acumula mudanças pendentes de vários campos — sem isso, editar
  // "nome" e depois "pontuação máxima" dentro da janela de debounce
  // cancelaria o timer do nome e só salvaria o último campo tocado.
  const pendingRef = useRef<UpdateScoringCriterionPayload>({});

  useEffect(() => {
    if (!criterion) return;
    setName(criterion.name);
    setMaxScore(String(criterion.maxScore));
    setDescription(criterion.description ?? "");
    setWeight(String(criterion.weight));
  }, [criterion]);

  async function persist(payload: UpdateScoringCriterionPayload) {
    if (!criterion) return;
    const updated = await scoringCriteriaApi.update(templateId, criterion.id, payload);
    onUpdated(updated);
  }

  function scheduleDebouncedSave(payload: UpdateScoringCriterionPayload) {
    pendingRef.current = { ...pendingRef.current, ...payload };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const toSave = pendingRef.current;
      pendingRef.current = {};
      persist(toSave);
    }, DEBOUNCE_MS);
  }

  if (!criterion) {
    return (
      <div className="flex h-full min-h-[20rem] items-center justify-center rounded-lg border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
        Selecione um critério na árvore para editar.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Editar critério</h2>
        <Button variant="destructive" size="sm" onClick={() => onRequestDelete(criterion)}>
          <Trash2 data-icon="inline-start" />
          Excluir
        </Button>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="criterion-name">Nome do critério</Label>
        <Input
          id="criterion-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            scheduleDebouncedSave({ name: e.target.value });
          }}
        />
      </div>

      <div className="grid gap-2">
        <Label>Tipo de critério</Label>
        <Select
          value={criterion.type}
          onValueChange={(value) => persist({ type: value as ScoringCriterionType })}
          disabled={hasChildren}
        >
          <SelectTrigger className="w-full">
            <SelectValue>{(value: ScoringCriterionType) => TYPE_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TYPE_LABELS) as ScoringCriterionType[]).map((key) => (
              <SelectItem key={key} value={key}>
                {TYPE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {hasChildren
            ? "Não é possível mudar o tipo enquanto o critério tiver filhos."
            : "Grupos organizam critérios. Itens de avaliação recebem notas."}
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="criterion-max-score">Pontuação máxima</Label>
        <Input
          id="criterion-max-score"
          type="number"
          step={0.01}
          value={maxScore}
          onChange={(e) => {
            setMaxScore(e.target.value);
            const parsed = Number(e.target.value);
            if (e.target.value.trim() !== "" && !Number.isNaN(parsed)) {
              scheduleDebouncedSave({ maxScore: parsed });
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Pontuação máxima que este critério pode receber.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="criterion-description">
          Descrição{" "}
          <span className="text-sm font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <textarea
          id="criterion-description"
          rows={3}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            scheduleDebouncedSave({ description: e.target.value });
          }}
          className="w-full rounded-lg border border-transparent bg-muted px-4 py-2.5 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:bg-muted/70 focus-visible:border-primary focus-visible:bg-primary/[0.06]"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="criterion-weight">
          Peso <span className="text-sm font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="criterion-weight"
          type="number"
          step={0.01}
          value={weight}
          onChange={(e) => {
            setWeight(e.target.value);
            const parsed = Number(e.target.value);
            if (e.target.value.trim() !== "" && !Number.isNaN(parsed)) {
              scheduleDebouncedSave({ weight: parsed });
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Utilizado para cálculos ponderados (padrão: 1,00).
        </p>
      </div>

      <div className="grid gap-2.5">
        <p className="text-sm font-medium text-foreground">Opções</p>
        <label className="flex items-center gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            checked={criterion.showInJudgingSheet}
            onChange={(e) => persist({ showInJudgingSheet: e.target.checked })}
            className="size-4 accent-primary"
          />
          Exibir na planilha de julgamento
        </label>
        <label className="flex items-center gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            checked={criterion.allowDecimalScoring}
            onChange={(e) => persist({ allowDecimalScoring: e.target.checked })}
            className="size-4 accent-primary"
          />
          Permitir pontuação decimal
        </label>
        <label className="flex items-center gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            checked={criterion.isRequired}
            onChange={(e) => persist({ isRequired: e.target.checked })}
            className="size-4 accent-primary"
          />
          Este critério é obrigatório
        </label>
      </div>
    </div>
  );
}

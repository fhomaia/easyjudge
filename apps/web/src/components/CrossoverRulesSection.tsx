import { useEffect, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/FormError";
import { cn } from "@/lib/utils";
import {
  ApiError,
  regulationApi,
  type CrossoverRules,
  type Regulation,
} from "@/api/client";

// Regras de crossover do evento (2026-10-07). Não existe regra oficial:
// cada produtor liga o que quiser. Violar uma regra vira pendência que
// impede o envio da ficha do programa (num conflito entre dois programas,
// fica com quem inscreveu o atleta por último). Salva a cada mudança; os
// números, ao sair do campo.
export function CrossoverRulesSection({
  eventId,
  rules,
  onSaved,
}: {
  eventId: string;
  rules: CrossoverRules;
  onSaved: (regulation: Regulation) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function save(next: CrossoverRules) {
    setError(null);
    try {
      // Só os campos atuais: o estado pode ter vindo de uma versão antiga
      // da API (a rota recusa campos a mais).
      onSaved(
        await regulationApi.setCrossoverRules(eventId, {
          maxTeams: next.maxTeams ?? null,
          maxCategories: next.maxCategories ?? null,
          maxTeamCheerCrossover: next.maxTeamCheerCrossover ?? null,
          maxLevelDifference: next.maxLevelDifference ?? null,
          crossProgram: next.crossProgram ?? "by_institution",
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    }
  }

  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-lg border border-border/60 bg-card p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Regras de crossover</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina em quantas e em quais equipes e categorias o mesmo atleta pode competir. Uma regra
          violada vira pendência na ficha do programa e impede o envio. Quando o conflito é entre
          dois programas, a pendência fica com quem inscreveu o atleta por último.
        </p>
      </div>

      <FormError message={error} />

      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">O atleta não compete contra ele mesmo</p>
          <p className="text-xs text-muted-foreground">
            Sempre vale: o mesmo atleta não pode estar duas vezes na mesma categoria, nem em duas
            equipes nem em dois programas.
          </p>
        </div>
      </div>

      <div className="grid gap-1 divide-y divide-border/60">
        <CrossProgramRule
          rules={rules}
          onChange={(next) => void save({ ...rules, ...next })}
        />
        <NumberRule
          id="max-teams"
          title="Limitar o número de equipes por atleta"
          hint="Ao ativar esta opção você escolherá a quantidade máxima de equipes permitida por atleta."
          unit={(n) => (n === 1 ? "equipe" : "equipes")}
          value={rules.maxTeams}
          defaultValue={3}
          min={1}
          onChange={(v) => void save({ ...rules, maxTeams: v })}
        />
        <NumberRule
          id="max-categories"
          title="Limitar o número de categorias por atleta"
          hint="Ao ativar esta opção você escolherá a quantidade máxima de categorias permitida por atleta."
          unit={(n) => (n === 1 ? "categoria" : "categorias")}
          value={rules.maxCategories}
          defaultValue={6}
          min={1}
          onChange={(v) => void save({ ...rules, maxCategories: v })}
        />
        <NumberRule
          id="max-team-cheer-crossover"
          title="Limitar o número de atletas de crossover no Team Cheer"
          hint="Ao ativar esta opção você escolherá a quantidade máxima de atletas inscritos em uma categoria de Team Cheer que podem ser reutilizados em outra categoria Team Cheer. Essa verificação não é feita entre categorias de gêneros diferentes."
          unit={(n) => (n === 1 ? "atleta reutilizado" : "atletas reutilizados")}
          value={rules.maxTeamCheerCrossover}
          defaultValue={2}
          min={0}
          onChange={(v) => void save({ ...rules, maxTeamCheerCrossover: v })}
        />
        <NumberRule
          id="max-level-difference"
          title="Limitar a diferença de nível entre as categorias do atleta"
          hint="Ao ativar esta opção você escolherá a diferença de nível máxima permitida entre as categorias do atleta na mesma modalidade. Ex: Se a diferença máxima for de um nível, o atleta que compete no nível 2 pode competir também em categorias do nível 1 e 3 mas não pode competir em categorias do nível 4 da mesma modalidade."
          unit={(n) => (n === 1 ? "nível de diferença" : "níveis de diferença")}
          value={rules.maxLevelDifference}
          defaultValue={1}
          min={0}
          onChange={(v) => void save({ ...rules, maxLevelDifference: v })}
        />
      </div>
    </section>
  );
}

const CROSS_PROGRAM_OPTIONS: {
  value: CrossoverRules["crossProgram"];
  label: string;
  hint: string;
}[] = [
  {
    value: "by_institution",
    label: "Um programa por vínculo institucional",
    hint: "Ex.: um atleta pode participar de um programa All Star e de um programa universitário, mas não pode participar de dois programas All Star ou de dois programas universitários.",
  },
  { value: "allowed", label: "Permitido", hint: "O atleta pode competir por mais de um programa." },
  { value: "none", label: "Não permitido", hint: "O atleta compete por um programa só no evento." },
];

function CrossProgramRule({
  rules,
  onChange,
}: {
  rules: CrossoverRules;
  onChange: (next: Pick<CrossoverRules, "crossProgram">) => void;
}) {
  return (
    <div className="py-3 text-sm">
      <p className="font-medium text-foreground">Crossover entre programas</p>
      <div className="mt-2 grid gap-2" role="radiogroup" aria-label="Crossover entre programas">
        {CROSS_PROGRAM_OPTIONS.map((option) => {
          const on = rules.crossProgram === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => !on && onChange({ crossProgram: option.value })}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  on ? "border-primary" : "border-muted-foreground/50",
                )}
              >
                {on && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <span>
                <span className="block font-medium text-foreground">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RuleRow({
  id,
  title,
  hint,
  checked,
  onCheckedChange,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 text-sm">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="cursor-pointer font-medium text-foreground">
          {title}
        </label>
        <p className="text-xs text-muted-foreground">{hint}</p>
        {children}
      </div>
    </div>
  );
}

// Regra numérica: a chave liga/desliga (desligada = sem limite); o número
// fica como texto enquanto digita e salva ao sair do campo.
function NumberRule({
  id,
  title,
  hint,
  unit,
  value,
  defaultValue,
  min,
  max = 50,
  onChange,
}: {
  id: string;
  title: string;
  hint: string;
  unit: (n: number) => string;
  value: number | null;
  defaultValue: number;
  min: number;
  max?: number;
  onChange: (value: number | null) => void;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => setText(value == null ? "" : String(value)), [value]);

  function commit() {
    const n = Math.max(min, Math.min(max, Math.trunc(Number(text))));
    if (text.trim() === "" || Number.isNaN(n)) {
      setText(String(value ?? defaultValue));
      return;
    }
    setText(String(n));
    if (n !== value) onChange(n);
  }

  return (
    <RuleRow
      id={id}
      title={title}
      hint={hint}
      checked={value != null}
      onCheckedChange={(checked) => onChange(checked ? defaultValue : null)}
    >
      {value != null && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-muted-foreground">Até</span>
          <Input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="h-8 w-20"
            aria-label={title}
          />
          <span className="text-muted-foreground">{unit(Number(text) || 0)}</span>
        </div>
      )}
    </RuleRow>
  );
}

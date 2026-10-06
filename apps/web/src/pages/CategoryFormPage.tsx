import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Check,
  Clock,
  Info,
  Pencil,
  Plus,
  Settings2,
  Star,
  Trash2,
  Trophy,
  Users,
  UsersRound,
  VenusAndMars,
  type LucideIcon,
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CriterionOptionsDialog } from "@/components/CriterionOptionsDialog";
import { DatePicker } from "@/components/DatePicker";
import { FormError } from "@/components/FormError";
import { NotificationBell } from "@/components/NotificationBell";
import { PageLoadingOverlay } from "@/components/PageLoadingOverlay";
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
  CRITERION_LABELS,
  CRITERION_ORDER,
  OPTION_CRITERION_FIELDS,
  buildCategoryName,
  criterionAppliesTo,
  defaultPresentationTimeSeconds,
  effectiveNonTumbling,
  isOptionCriterion,
  levelExplanation,
  levelLabel,
  type CategoryCriteriaValues,
} from "@/lib/categoryCriteria";
import { FORMAT_LABELS, STATUS_LABELS, formatLabelFor, isAlwaysNonTumbling } from "@/lib/categoryLabels";
import { getDefaultWarmupMinutes, secondsToMinutesAndSeconds } from "@/lib/presentationTime";
import { scoringTemplateLabel } from "@/lib/scoringTemplateLabel";
import { useEventSetupGuard } from "@/lib/useEventSetupGuard";
import { useNotificationsUnreadCount } from "@/lib/useNotificationsUnreadCount";
import { cn } from "@/lib/utils";
import {
  ApiError,
  categoriesApi,
  categoryCriteriaApi,
  eventScoringTemplatesApi,
  scoringTemplatesApi,
  usersApi,
  type Category,
  type CategoryCriterion,
  type CategoryCriterionKey,
  type CategoryCriterionOption,
  type CategoryFormat,
  type CategoryStatus,
  type ScoringTemplate,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

// Teto de categorias criadas de uma vez (evita um clique gerar centenas
// por engano).
const MAX_COMBINATIONS = 60;

const CRITERION_STYLE: Record<CategoryCriterionKey, { icon: LucideIcon; tone: string }> = {
  institution: { icon: Building2, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  regime: { icon: Clock, tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  age_group: { icon: Users, tone: "bg-green-500/15 text-green-600 dark:text-green-400" },
  gender: { icon: VenusAndMars, tone: "bg-pink-500/15 text-pink-600 dark:text-pink-400" },
  level: { icon: Star, tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  size: { icon: UsersRound, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
};

const CRITERION_PROMPT: Record<CategoryCriterionKey, { multi: string; single: string }> = {
  institution: {
    multi: "Selecione o(s) vínculo(s) institucional(is).",
    single: "Escolha o vínculo institucional.",
  },
  regime: { multi: "Selecione o(s) regime(s) de competição.", single: "Escolha o regime de competição." },
  age_group: { multi: "Selecione a(s) faixa(s) etária(s).", single: "Escolha a faixa etária." },
  gender: { multi: "Selecione o(s) gênero(s).", single: "Escolha o gênero." },
  level: {
    multi: "Selecione o(s) nível(is) da categoria.",
    single: "Escolha o nível da categoria.",
  },
  size: { multi: "Selecione o(s) tamanho(s) da equipe.", single: "Escolha o tamanho da equipe." },
};

// Opção mostrada num card. No Nível o valor é "nível|semTumbling" (a
// categoria guarda o número, não um id).
interface ChoiceOption {
  value: string;
  label: string;
  // Opção criada pelo produtor (tem lápis de editar).
  editableId?: string | null;
  // Regra da opção, embaixo do nome (idade, atletas, tempo).
  hint?: string | null;
}

// Botão que abre as opções e regras: só nas divisões com regra (idade e
// número de atletas). As outras só ganham opção pelo "+ Adicionar".
const MANAGE_LABELS: Partial<Record<CategoryCriterionKey, string>> = {
  age_group: "Editar idades",
  size: "Editar nº de atletas",
};

function optionHint(
  key: CategoryCriterionKey,
  option: CategoryCriterionOption,
): string | null {
  if (key === "size") {
    const { minAthletes: min, maxAthletes: max } = option;
    if (min != null && max != null) return `${min} a ${max} atletas`;
    if (min != null) return `${min}+ atletas`;
    if (max != null) return `até ${max} atletas`;
    return "sem limite de atletas";
  }
  if (key === "age_group") {
    const { minAge: min, maxAge: max } = option;
    if (min != null && max != null) return `${min} a ${max} anos`;
    if (min != null) return `${min}+ anos`;
    if (max != null) return `até ${max} anos`;
    return "sem limite de idade";
  }
  return null;
}

type Selections = Record<CategoryCriterionKey, string[]>;

const EMPTY_SELECTIONS: Selections = {
  institution: [],
  regime: [],
  age_group: [],
  gender: [],
  level: [],
  size: [],
};

const levelValue = (level: number, nonTumbling: boolean) => `${level}|${nonTumbling}`;

function parseLevelValue(value: string): { level: number; nonTumbling: boolean } {
  const [level, nonTumbling] = value.split("|");
  return { level: Number(level), nonTumbling: nonTumbling === "true" };
}

function sizeHint(criteria: CategoryCriterion[], id: string): string | null {
  const option = criteria.find((c) => c.key === "size")?.options.find((o) => o.id === id);
  if (!option) return null;
  const { minAthletes: min, maxAthletes: max } = option;
  if (min != null && max != null) return `${option.label}: de ${min} a ${max} atletas.`;
  if (min != null) return `${option.label}: a partir de ${min} atletas.`;
  if (max != null) return `${option.label}: até ${max} atletas.`;
  return null;
}

function ageHint(criteria: CategoryCriterion[], id: string): string | null {
  const criterion = criteria.find((c) => c.key === "age_group");
  const option = criterion?.options.find((o) => o.id === id);
  if (!option || (option.minAge == null && option.maxAge == null)) return null;
  const parts = [
    option.minAge != null ? `a partir de ${option.minAge} anos` : null,
    option.maxAge != null ? `até ${option.maxAge} anos` : null,
  ].filter(Boolean);
  const date = criterion?.ageCutoffDate
    ? ` completados até ${criterion.ageCutoffDate.split("-").reverse().join("/")}`
    : "";
  return `${option.label}: ${parts.join(" e ")}${date}.`;
}

// Nova categoria (várias opções por divisão = uma categoria por
// combinação) e editar categoria (uma opção por divisão, num seletor).
// Cada divisão é opcional: sem nada marcado, a categoria não usa ela.
export function CategoryFormPage() {
  const { id, categoryId } = useParams<{ id: string; categoryId?: string }>();
  const isEdit = !!categoryId;
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const notificationsUnreadCount = useNotificationsUnreadCount(id);
  useEventSetupGuard(id);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [criteria, setCriteria] = useState<CategoryCriterion[] | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [scoringTemplates, setScoringTemplates] = useState<ScoringTemplate[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [categoryFormat, setCategoryFormat] = useState<CategoryFormat>("team_cheer");
  const [customFormatLabel, setCustomFormatLabel] = useState("");
  const [selections, setSelections] = useState<Selections>(EMPTY_SELECTIONS);
  const [customName, setCustomName] = useState<string | null>(null);
  const [scoringTemplateId, setScoringTemplateId] = useState("");
  // Tempo digitado à mão vale pra todas as categorias criadas; sem isso,
  // cada uma usa o padrão da própria combinação (modalidade, vínculo e
  // regime).
  const [presentationTouched, setPresentationTouched] = useState(false);
  const [presentationMinutes, setPresentationMinutes] = useState("2");
  const [presentationSeconds, setPresentationSeconds] = useState("30");
  const [warmupMinutes, setWarmupMinutes] = useState(String(getDefaultWarmupMinutes("team_cheer")));
  const [status, setStatus] = useState<CategoryStatus>("active");
  // Regra direta da categoria (texto enquanto digita; vazio = sem limite).
  // Só aparece sem divisão de Tamanho / Faixa etária marcada.
  const [minAthletes, setMinAthletes] = useState("");
  const [maxAthletes, setMaxAthletes] = useState("");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  // Data de referência da idade da regra direta; "" = ainda não escolhida
  // (mostra a padrão do evento).
  const [ruleCutoff, setRuleCutoff] = useState("");

  const [optionsDialog, setOptionsDialog] = useState<{
    key: CategoryCriterionKey;
    newOption: boolean;
    // Lápis de uma opção criada pelo produtor.
    editOptionId?: string;
  } | null>(null);
  // Lixeira de uma opção criada pelo produtor (com confirmação).
  const [deleteTarget, setDeleteTarget] = useState<{
    key: CategoryCriterionKey;
    optionId: string;
    label: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    categoryCriteriaApi
      .get(id)
      .then(setCriteria)
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : "Não foi possível carregar a tela."),
      );
    eventScoringTemplatesApi
      .list(id)
      .then((templates) => setScoringTemplates(templates.filter((t) => t.isComplete)))
      .catch(() => setScoringTemplates([]));
    if (categoryId) {
      categoriesApi
        .list(id)
        .then((list) => {
          const found = list.find((c) => c.id === categoryId);
          if (!found) {
            setLoadError("Categoria não encontrada.");
            return;
          }
          setCategory(found);
          setCategoryFormat(found.categoryFormat);
          setCustomFormatLabel(found.customFormatLabel ?? "");
          setSelections({
            institution: found.institution ? [found.institution] : [],
            regime: found.regime ? [found.regime] : [],
            age_group: found.ageGroup ? [found.ageGroup] : [],
            gender: found.gender ? [found.gender] : [],
            level:
              found.level != null
                ? [
                    levelValue(
                      found.level,
                      effectiveNonTumbling(found.categoryFormat, found.nonTumbling),
                    ),
                  ]
                : [],
            size: found.size ? [found.size] : [],
          });
          setCustomName(found.name);
          setScoringTemplateId(found.scoringTemplateId ?? "");
          if (found.presentationTimeSeconds != null) {
            const time = secondsToMinutesAndSeconds(found.presentationTimeSeconds);
            setPresentationMinutes(String(time.minutes));
            setPresentationSeconds(String(time.seconds).padStart(2, "0"));
            setPresentationTouched(true);
          }
          setWarmupMinutes(String(found.warmupMinutes));
          setStatus(found.status);
          setMinAthletes(found.minAthletes != null ? String(found.minAthletes) : "");
          setMaxAthletes(found.maxAthletes != null ? String(found.maxAthletes) : "");
          setMinAge(found.minAge != null ? String(found.minAge) : "");
          setMaxAge(found.maxAge != null ? String(found.maxAge) : "");
          setRuleCutoff(found.ageCutoffDate ?? "");
          // Sistema de pontuação fora da seleção do evento (removido
          // depois de atribuído): busca pra o seletor não ficar vazio.
          if (found.scoringTemplateId) {
            scoringTemplatesApi
              .get(found.scoringTemplateId)
              .then((t) =>
                setScoringTemplates((prev) =>
                  prev.some((p) => p.id === t.id) ? prev : [...prev, t],
                ),
              )
              .catch(() => {});
          }
        })
        .catch((err) =>
          setLoadError(
            err instanceof ApiError ? err.message : "Não foi possível carregar a categoria.",
          ),
        );
    }
  }, [id, categoryId]);

  // Opções de cada card. Nível: paleta do evento + o nível atual da
  // categoria editada, se não estiver na paleta.
  const choices = useMemo(() => {
    const map = {} as Record<CategoryCriterionKey, ChoiceOption[]>;
    for (const criterion of criteria ?? []) {
      if (isOptionCriterion(criterion.key)) {
        map[criterion.key] = criterion.options
          .filter((o) => o.id)
          .map((o) => ({
            value: o.id as string,
            label: o.label,
            hint: optionHint(criterion.key, o),
            editableId: o.builtIn ? null : o.id,
          }));
        continue;
      }
      const levels: ChoiceOption[] = criterion.options
        .filter((o) => o.level != null)
        .map((o) => ({
          value: levelValue(o.level as number, !!o.nonTumbling),
          label: o.label,
          editableId: o.builtIn ? null : o.id,
        }));
      for (const value of selections.level) {
        if (!levels.some((l) => l.value === value)) {
          const parsed = parseLevelValue(value);
          levels.push({ value, label: levelLabel(parsed.level, parsed.nonTumbling) });
        }
      }
      map.level = levels;
    }
    return map;
  }, [criteria, selections.level]);

  // Marcadas na ordem da lista (não na ordem do clique).
  function ordered(key: CategoryCriterionKey): string[] {
    const order = (choices[key] ?? []).map((c) => c.value);
    return [...selections[key]].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }

  // Nível sem tumbling não existe nos stunts: some da lista.
  function visibleChoices(key: CategoryCriterionKey): ChoiceOption[] {
    const list = choices[key] ?? [];
    if (key !== "level" || !isAlwaysNonTumbling(categoryFormat)) return list;
    return list.filter((o) => !parseLevelValue(o.value).nonTumbling);
  }

  const usesSize = criterionAppliesTo("size", categoryFormat) && selections.size.length > 0;
  const usesAgeGroup = selections.age_group.length > 0;
  const ageCutoff = criteria?.find((c) => c.key === "age_group")?.ageCutoffDate ?? null;

  // Data de referência da regra direta começa com a padrão do evento
  // (uma vez só; depois o campo é do usuário).
  const [ruleCutoffSeeded, setRuleCutoffSeeded] = useState(false);
  useEffect(() => {
    if (ruleCutoffSeeded || !ageCutoff || (isEdit && !category)) return;
    setRuleCutoffSeeded(true);
    setRuleCutoff((current) => current || ageCutoff);
  }, [ruleCutoffSeeded, ageCutoff, isEdit, category]);

  const appliedKeys = CRITERION_ORDER.filter((key) => criterionAppliesTo(key, categoryFormat));

  // Uma linha de valores por categoria a criar: produto cartesiano das
  // opções marcadas (divisão sem nada marcado = não usada).
  const combinations = useMemo<CategoryCriteriaValues[]>(() => {
    let combos: CategoryCriteriaValues[] = [
      {
        institution: null,
        regime: null,
        ageGroup: null,
        gender: null,
        size: null,
        level: null,
        nonTumbling: false,
      },
    ];
    for (const key of CRITERION_ORDER) {
      if (!criterionAppliesTo(key, categoryFormat)) continue;
      const chosen = ordered(key);
      if (chosen.length === 0) continue;
      combos = combos.flatMap((c) =>
        chosen.map((value) => {
          if (isOptionCriterion(key)) return { ...c, [OPTION_CRITERION_FIELDS[key]]: value };
          const parsed = parseLevelValue(value);
          return {
            ...c,
            level: parsed.level,
            nonTumbling: isAlwaysNonTumbling(categoryFormat) || parsed.nonTumbling,
          };
        }),
      );
    }
    return combos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections, categoryFormat, choices]);

  const names = useMemo(
    () =>
      criteria
        ? combinations.map((values) =>
            buildCategoryName(
              categoryFormat,
              categoryFormat === "custom" ? customFormatLabel.trim() || null : null,
              values,
              criteria,
            ),
          )
        : [],
    [combinations, categoryFormat, customFormatLabel, criteria],
  );
  const single = combinations.length === 1;
  const autoName = names[0] ?? "";

  // Editar: nome salvo igual ao automático continua automático (acompanha
  // a troca de divisões); diferente = nome escolhido pelo usuário.
  const [nameChecked, setNameChecked] = useState(false);
  useEffect(() => {
    if (!isEdit || nameChecked || !category || !criteria || !autoName) return;
    setNameChecked(true);
    if (category.name === autoName) setCustomName(null);
  }, [isEdit, nameChecked, category, criteria, autoName]);

  const defaultTimes = useMemo(
    () =>
      criteria
        ? combinations.map((c) => defaultPresentationTimeSeconds(categoryFormat, c))
        : [],
    [combinations, categoryFormat, criteria],
  );

  // Tempo mostrado enquanto não foi digitado à mão: o da primeira
  // combinação.
  useEffect(() => {
    if (presentationTouched || defaultTimes.length === 0) return;
    const time = secondsToMinutesAndSeconds(defaultTimes[0]);
    setPresentationMinutes(String(time.minutes));
    setPresentationSeconds(String(time.seconds).padStart(2, "0"));
  }, [defaultTimes, presentationTouched]);

  function changeFormat(format: CategoryFormat) {
    setCategoryFormat(format);
    setWarmupMinutes(String(getDefaultWarmupMinutes(format)));
    // Trocar a modalidade desatualiza o nome digitado à mão.
    if (isEdit) setCustomName(null);
  }

  function toggle(key: CategoryCriterionKey, value: string) {
    setSelections((prev) => {
      const list = prev[key];
      return {
        ...prev,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
    });
  }

  function choose(key: CategoryCriterionKey, value: string | null) {
    setSelections((prev) => ({ ...prev, [key]: value ? [value] : [] }));
  }

  // Níveis da paleta (valor "nível|semTumbling").
  function levelValuesOf(list: CategoryCriterion[] | null): Set<string> {
    return new Set(
      (list?.find((c) => c.key === "level")?.options ?? [])
        .filter((o) => o.level != null)
        .map((o) => levelValue(o.level as number, !!o.nonTumbling)),
    );
  }

  // Nível que saiu da paleta (excluído ou trocado) sai da seleção também;
  // senão continuava marcado e reaparecia no fim da lista.
  function dropRemovedLevels(saved: CategoryCriterion[]) {
    const before = levelValuesOf(criteria);
    const after = levelValuesOf(saved);
    setSelections((prev) => ({
      ...prev,
      level: prev.level.filter((v) => !before.has(v) || after.has(v)),
    }));
  }

  async function handleDeleteOption() {
    if (!id || !criteria || !deleteTarget) return;
    const payload = criteria.map((c) =>
      c.key === deleteTarget.key
        ? { ...c, options: c.options.filter((o) => o.id !== deleteTarget.optionId) }
        : c,
    );
    const saved = await categoryCriteriaApi.update(id, payload);
    dropRemovedLevels(saved);
    setCriteria(saved);
  }

  function handleOptionsSaved(saved: CategoryCriterion[], newIds: string[]) {
    const key = optionsDialog?.key;
    dropRemovedLevels(saved);
    setCriteria(saved);
    if (!key || newIds.length === 0) return;
    // Opção recém-criada já entra marcada.
    const criterion = saved.find((c) => c.key === key);
    const created =
      key === "level"
        ? (criterion?.options ?? [])
            .filter((o) => o.id && newIds.includes(o.id) && o.level != null)
            .map((o) => levelValue(o.level as number, !!o.nonTumbling))
        : newIds;
    setSelections((prev) => ({
      ...prev,
      [key]: isEdit ? created.slice(-1) : [...prev[key], ...created],
    }));
  }

  // Opção excluída no popup some da seleção.
  useEffect(() => {
    if (!criteria) return;
    setSelections((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const criterion of criteria) {
        if (!isOptionCriterion(criterion.key)) continue;
        const ids = new Set(criterion.options.map((o) => o.id));
        const kept = prev[criterion.key].filter((v) => ids.has(v));
        if (kept.length !== prev[criterion.key].length) {
          next[criterion.key] = kept;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [criteria]);

  async function handleSubmit() {
    if (!id || !criteria) return;
    setError(null);

    if (categoryFormat === "custom" && !customFormatLabel.trim()) {
      setError("Informe o nome da modalidade customizada.");
      return;
    }
    if (selections.gender.length === 0) {
      setError("Escolha o gênero da categoria.");
      return;
    }
    if (selections.level.length === 0) {
      setError("Escolha o nível da categoria.");
      return;
    }
    if (combinations.length > MAX_COMBINATIONS) {
      setError(
        `Essa seleção criaria ${combinations.length} categorias. O máximo de uma vez é ${MAX_COMBINATIONS}.`,
      );
      return;
    }
    if (!scoringTemplateId) {
      setError("Selecione um sistema de pontuação.");
      return;
    }
    const typedTime = Number(presentationMinutes || 0) * 60 + Number(presentationSeconds || 0);
    if (presentationTouched && typedTime <= 0) {
      setError("Informe o tempo de apresentação.");
      return;
    }
    const warmup = Number(warmupMinutes || 0);
    if (warmup <= 0) {
      setError("Informe o tempo de aquecimento.");
      return;
    }
    const toNumber = (v: string) => (v.trim() === "" ? null : Number(v));
    const rules = {
      minAthletes: usesSize ? null : toNumber(minAthletes),
      maxAthletes: usesSize ? null : toNumber(maxAthletes),
      minAge: usesAgeGroup ? null : toNumber(minAge),
      maxAge: usesAgeGroup ? null : toNumber(maxAge),
      ageCutoffDate: null as string | null,
    };
    // A data só importa com alguma idade definida.
    if (rules.minAge != null || rules.maxAge != null) {
      if (!ruleCutoff) {
        setError("Informe a data em que a idade é conferida.");
        return;
      }
      rules.ageCutoffDate = ruleCutoff;
    }
    if (rules.minAthletes != null && rules.maxAthletes != null && rules.minAthletes > rules.maxAthletes) {
      setError("O mínimo de atletas passa do máximo.");
      return;
    }
    if (rules.minAge != null && rules.maxAge != null && rules.minAge > rules.maxAge) {
      setError("A idade mínima passa da máxima.");
      return;
    }
    if (single && customName !== null && !customName.trim()) {
      setError("Informe o nome da categoria.");
      return;
    }

    const formatLabel = categoryFormat === "custom" ? customFormatLabel.trim() : null;
    const payloadFor = (values: CategoryCriteriaValues, index: number) => ({
      name: single && customName !== null ? customName.trim() : names[index],
      categoryFormat,
      customFormatLabel: formatLabel,
      ...values,
      ...rules,
      scoringTemplateId,
      presentationTimeSeconds: presentationTouched ? typedTime : defaultTimes[index],
      warmupMinutes: warmup,
    });

    setSaving(true);
    let created = 0;
    try {
      if (isEdit && categoryId) {
        await categoriesApi.update(id, categoryId, { ...payloadFor(combinations[0], 0), status });
      } else {
        for (const [index, values] of combinations.entries()) {
          await categoriesApi.create(id, payloadFor(values, index));
          created += 1;
        }
      }
      navigate(`/events/${id}/categories`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.";
      setError(
        created > 0
          ? `${created} de ${combinations.length} categorias foram criadas. Na seguinte: ${message}`
          : message,
      );
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const ready = criteria !== null && (!isEdit || category !== null);

  // Erro + Cancelar/Criar: no fim do formulário (computador) ou depois do
  // resumo (celular, onde o resumo fica embaixo do formulário).
  const actions = (
    <div className="grid gap-3">
      <FormError message={error} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() => navigate(`/events/${id}/categories`)}
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving
            ? "Salvando..."
            : isEdit
              ? "Salvar alterações"
              : single
                ? "Criar categoria"
                : `Criar ${combinations.length} categorias`}
        </Button>
      </div>
    </div>
  );

  const summaryItems = appliedKeys
    .map((key) => ({
      key,
      labels: ordered(key)
        .map((value) => choices[key]?.find((c) => c.value === value)?.label)
        .filter((label): label is string => !!label),
    }))
    .filter((item) => item.labels.length > 0);

  return (
    <div className="flex h-dvh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      <main className="relative flex-1 overflow-y-auto pt-14 sm:pt-0">
        <PageLoadingOverlay loading={!ready && !loadError} />
        <div className="flex items-center justify-between px-4 pt-6 sm:px-10">
          <button
            type="button"
            onClick={() => navigate(`/events/${id}/categories`)}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Categorias
          </button>
          <NotificationBell unreadCount={notificationsUnreadCount} />
        </div>

        <div className="px-4 pb-10 sm:px-10">
          <h1 className="mt-4 text-2xl font-semibold text-foreground sm:text-3xl">
            {isEdit ? "Editar categoria" : "Nova categoria"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEdit
              ? "Altere a modalidade, as divisões e os dados da categoria."
              : "Selecione a modalidade e defina quais divisões serão utilizadas para esta categoria."}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            <span className="text-destructive">*</span> Campos obrigatórios
          </p>

          {loadError && <p className="mt-6 text-sm text-destructive">{loadError}</p>}

          {ready && criteria && (
            <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid gap-8 rounded-xl border border-border/60 bg-card p-4 sm:p-6">
                <Step
                  number={1}
                  title="Modalidade"
                  required
                  description="Escolha a modalidade da categoria."
                >
                  <Select
                    value={categoryFormat}
                    onValueChange={(value) => changeFormat(value as CategoryFormat)}
                  >
                    <SelectTrigger className="h-12 w-full">
                      <SelectValue>
                        {(value: CategoryFormat) => (
                          <span className="flex items-center gap-3">
                            <Trophy className="size-4 text-primary" />
                            {FORMAT_LABELS[value]}
                          </span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FORMAT_LABELS) as CategoryFormat[]).map((key) => (
                        <SelectItem key={key} value={key}>
                          {FORMAT_LABELS[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {categoryFormat === "custom" && (
                    <div className="mt-3 grid gap-2">
                      <Label htmlFor="custom-format">
                        Nome da modalidade <RequiredMark />
                      </Label>
                      <Input
                        id="custom-format"
                        placeholder="Ex.: Freestyle Pom"
                        value={customFormatLabel}
                        onChange={(e) => setCustomFormatLabel(e.target.value)}
                      />
                    </div>
                  )}
                </Step>

                <Step
                  number={2}
                  title="Divisões da categoria"
                  description={
                    isEdit
                      ? "Gênero e nível são obrigatórios. Nas outras divisões, escolha \"Não usar\" quando a categoria não usa aquela divisão."
                      : "Gênero e nível são obrigatórios. Nas outras divisões, deixe sem nada marcado quando a categoria não usa aquela divisão. Mais de uma opção cria uma categoria para cada combinação."
                  }
                >
                  <div className="grid gap-3">
                    {appliedKeys.map((key) => (
                      <DivisionCard
                        key={key}
                        criterionKey={key}
                        prompt={isEdit ? CRITERION_PROMPT[key].single : CRITERION_PROMPT[key].multi}
                        manageLabel={MANAGE_LABELS[key]}
                        onManage={() => setOptionsDialog({ key, newOption: false })}
                        info={divisionInfo(key)}
                        note={key === "age_group" ? ageCutoffNote() : null}
                      >
                        {isEdit ? (
                          <SingleChoice
                            options={visibleChoices(key)}
                            value={selections[key][0] ?? null}
                            allowNone={key !== "level" && key !== "gender"}
                            onChange={(value) => choose(key, value)}
                            onAdd={() => setOptionsDialog({ key, newOption: true })}
                            onEdit={(optionId) =>
                              setOptionsDialog({ key, newOption: false, editOptionId: optionId })
                            }
                            onDelete={(optionId, label) =>
                              setDeleteTarget({ key, optionId, label })
                            }
                          />
                        ) : (
                          <MultiChoice
                            options={visibleChoices(key)}
                            selected={selections[key]}
                            onToggle={(value) => toggle(key, value)}
                            onAdd={() => setOptionsDialog({ key, newOption: true })}
                            onEdit={(optionId) =>
                              setOptionsDialog({ key, newOption: false, editOptionId: optionId })
                            }
                            onDelete={(optionId, label) =>
                              setDeleteTarget({ key, optionId, label })
                            }
                          />
                        )}
                      </DivisionCard>
                    ))}
                    {!criterionAppliesTo("size", categoryFormat) && (
                      <p className="text-xs text-muted-foreground">
                        Tamanho só existe nas modalidades de grupo (Team Cheer e Custom).
                      </p>
                    )}
                  </div>
                </Step>

                <Step
                  number={3}
                  title="Nome da categoria"
                  description={
                    single
                      ? "O nome é gerado automaticamente com base nas divisões selecionadas."
                      : "Cada categoria recebe o nome da sua combinação (veja no resumo)."
                  }
                >
                  {single ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={customName ?? autoName}
                        readOnly={customName === null}
                        onChange={(e) => setCustomName(e.target.value)}
                        className={cn(customName === null && "bg-muted text-muted-foreground")}
                        aria-label="Nome da categoria"
                      />
                      {customName === null ? (
                        <Button variant="outline" onClick={() => setCustomName(autoName)}>
                          <Pencil data-icon="inline-start" />
                          Editar nome
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={() => setCustomName(null)}>
                          Usar nome automático
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {combinations.length} nomes automáticos.
                    </p>
                  )}
                </Step>

                <Step
                  number={4}
                  title="Apresentação e regras"
                  description="Sistema de pontuação, tempos e limites de atletas e idade."
                >
                  <div className="grid gap-4">
                    <div className="grid min-w-0 gap-2">
                      <Label>
                        Sistema de pontuação <RequiredMark />
                      </Label>
                      <Select
                        value={scoringTemplateId || null}
                        onValueChange={(value) => setScoringTemplateId(value as string)}
                      >
                        <SelectTrigger className="w-full min-w-0">
                          <SelectValue>
                            {(value: string | null) => {
                              if (!value) return "Selecione um sistema de pontuação";
                              const t = scoringTemplates.find((item) => item.id === value);
                              return t ? (
                                <span className="truncate">{scoringTemplateLabel(t)}</span>
                              ) : undefined;
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {scoringTemplates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {scoringTemplateLabel(template)}
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

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="presentation-minutes">
                          Tempo de apresentação <RequiredMark />
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="presentation-minutes"
                            inputMode="numeric"
                            className="w-20"
                            aria-label="Minutos"
                            value={presentationMinutes}
                            onChange={(e) => {
                              setPresentationTouched(true);
                              setPresentationMinutes(e.target.value.replace(/\D/g, "").slice(0, 2));
                            }}
                          />
                          <span className="text-sm text-muted-foreground">min</span>
                          <Input
                            inputMode="numeric"
                            className="w-20"
                            aria-label="Segundos"
                            value={presentationSeconds}
                            onChange={(e) => {
                              setPresentationTouched(true);
                              setPresentationSeconds(e.target.value.replace(/\D/g, "").slice(0, 2));
                            }}
                          />
                          <span className="text-sm text-muted-foreground">seg</span>
                        </div>
                        {!presentationTouched && new Set(defaultTimes).size > 1 && (
                          <p className="text-xs text-muted-foreground">
                            Cada categoria usa o tempo padrão da sua combinação. Altere para usar
                            o mesmo tempo em todas.
                          </p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="warmup-minutes">
                          Tempo de aquecimento <RequiredMark />
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="warmup-minutes"
                            inputMode="numeric"
                            className="w-20"
                            value={warmupMinutes}
                            onChange={(e) =>
                              setWarmupMinutes(e.target.value.replace(/\D/g, "").slice(0, 3))
                            }
                          />
                          <span className="text-sm text-muted-foreground">min</span>
                        </div>
                      </div>
                    </div>

                    {isEdit && (
                      <div className="grid gap-2 sm:max-w-60">
                        <Label>Status</Label>
                        <Select
                          value={status}
                          onValueChange={(value) => setStatus(value as CategoryStatus)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {(value: CategoryStatus) => STATUS_LABELS[value]}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(STATUS_LABELS) as CategoryStatus[]).map((key) => (
                              <SelectItem key={key} value={key}>
                                {STATUS_LABELS[key]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {(!usesSize || !usesAgeGroup) && (
                      <div className="grid gap-4">
                      <OptionalDivider />
                      <div className="grid gap-4 sm:grid-cols-2">
                        {!usesSize && (
                          <RangeFields
                            title="Número de atletas"
                            unit="atletas"
                            hint="Vazio = sem limite. Conferido no envio da inscrição."
                            min={minAthletes}
                            max={maxAthletes}
                            onMinChange={setMinAthletes}
                            onMaxChange={setMaxAthletes}
                            maxDigits={3}
                          />
                        )}
                        {!usesAgeGroup && (
                          <RangeFields
                            title="Idade dos atletas"
                            unit="anos"
                            hint="Vazio = sem limite."
                            footer={
                              <div className="grid gap-1.5">
                                <Label htmlFor="rule-age-cutoff" className="text-xs">
                                  Idade completada até
                                </Label>
                                <div className="max-w-56">
                                  <DatePicker
                                    id="rule-age-cutoff"
                                    value={ruleCutoff}
                                    onChange={setRuleCutoff}
                                    captionLayout="dropdown"
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  A idade de cada atleta é a que ele tem nessa data.
                                </p>
                              </div>
                            }
                            min={minAge}
                            max={maxAge}
                            onMinChange={setMinAge}
                            onMaxChange={setMaxAge}
                            maxDigits={2}
                          />
                        )}
                      </div>
                      </div>
                    )}
                  </div>
                </Step>

                {/* Computador: ações no fim do formulário. No celular elas
                    vão pra depois do resumo (ver abaixo). */}
                <div className="hidden border-t border-border/60 pt-6 lg:block">{actions}</div>
              </div>

              <aside className="grid gap-4 rounded-xl border border-border/60 bg-card p-5 lg:sticky lg:top-6">
                <p className="text-lg font-semibold text-foreground">Resumo da categoria</p>
                <SummaryRow
                  icon={Trophy}
                  tone="bg-primary/10 text-primary"
                  title="Modalidade"
                  value={formatLabelFor(categoryFormat, customFormatLabel.trim() || null)}
                />
                {summaryItems.map((item) => (
                  <SummaryRow
                    key={item.key}
                    icon={CRITERION_STYLE[item.key].icon}
                    tone={CRITERION_STYLE[item.key].tone}
                    title={CRITERION_LABELS[item.key]}
                    value={item.labels.join(", ")}
                  />
                ))}
                {!usesSize && rangeLabel(minAthletes, maxAthletes, "atletas") && (
                  <SummaryRow
                    icon={UsersRound}
                    tone={CRITERION_STYLE.size.tone}
                    title="Número de atletas"
                    value={rangeLabel(minAthletes, maxAthletes, "atletas") as string}
                  />
                )}
                {!usesAgeGroup && rangeLabel(minAge, maxAge, "anos") && (
                  <SummaryRow
                    icon={Users}
                    tone={CRITERION_STYLE.age_group.tone}
                    title="Idade dos atletas"
                    value={rangeLabel(minAge, maxAge, "anos") as string}
                  />
                )}
                <div className="grid gap-1 border-t border-border/60 pt-4">
                  <p className="text-sm text-muted-foreground">
                    {single ? "Nome da categoria" : "Nomes das categorias"}
                  </p>
                  {single ? (
                    <p className="font-semibold text-foreground">{customName ?? autoName}</p>
                  ) : (
                    <ul className="grid max-h-64 gap-1 overflow-y-auto text-sm font-medium text-foreground">
                      {names.map((name, index) => (
                        <li key={index}>{name}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {!isEdit && (
                  <div className="flex items-center gap-3 rounded-lg bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
                    <Users className="size-4 shrink-0" />
                    {single ? "1 categoria será criada" : `${combinations.length} categorias serão criadas`}
                  </div>
                )}
              </aside>

              <div className="grid gap-3 lg:hidden">{actions}</div>
            </div>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir opção"
        description={`Excluir "${deleteTarget?.label}" das opções deste evento? Não dá para excluir uma opção usada por alguma categoria.`}
        confirmLabel="Excluir"
        confirmingLabel="Excluindo..."
        onConfirm={handleDeleteOption}
      />

      {id && criteria && (
        <CriterionOptionsDialog
          eventId={id}
          criterionKey={optionsDialog?.key ?? null}
          startWithNewOption={optionsDialog?.newOption ?? false}
          editOptionId={optionsDialog?.editOptionId ?? null}
          criteria={criteria}
          onOpenChange={(open) => !open && setOptionsDialog(null)}
          onSaved={handleOptionsSaved}
        />
      )}
    </div>
  );

  // Data em que a idade é conferida, sempre visível no card da Faixa
  // etária (sem data escolhida, a API devolve a data do evento).
  function ageCutoffNote(): string | null {
    const date = criteria?.find((c) => c.key === "age_group")?.ageCutoffDate;
    return date ? `Idade completada até ${date.split("-").reverse().join("/")}.` : null;
  }

  // Caixa de informação embaixo das opções (só com uma opção escolhida).
  function divisionInfo(key: CategoryCriterionKey): string | null {
    if (!criteria || selections[key].length !== 1) return null;
    const value = selections[key][0];
    if (key === "level") {
      const parsed = parseLevelValue(value);
      return levelExplanation(parsed.level, effectiveNonTumbling(categoryFormat, parsed.nonTumbling));
    }
    if (key === "size") return sizeHint(criteria, value);
    if (key === "age_group") return ageHint(criteria, value);
    return null;
  }
}

// "5 a 15 atletas", "até 17 anos", "10+ anos"; null sem limite nenhum.
function rangeLabel(min: string, max: string, unit: string): string | null {
  if (min && max) return `${min} a ${max} ${unit}`;
  if (min) return `${min}+ ${unit}`;
  if (max) return `até ${max} ${unit}`;
  return null;
}

function RangeFields({
  title,
  unit,
  hint,
  min,
  max,
  onMinChange,
  onMaxChange,
  maxDigits,
  footer,
}: {
  title: string;
  unit: string;
  hint: string;
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  maxDigits: number;
  footer?: ReactNode;
}) {
  const clean = (value: string) => value.replace(/\D/g, "").slice(0, maxDigits);
  return (
    <div className="grid content-start gap-2">
      <Label>{title}</Label>
      <div className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          className="w-20"
          placeholder="Mín."
          aria-label={`${title}: mínimo`}
          value={min}
          onChange={(e) => onMinChange(clean(e.target.value))}
        />
        <span className="text-sm text-muted-foreground">a</span>
        <Input
          inputMode="numeric"
          className="w-20"
          placeholder="Máx."
          aria-label={`${title}: máximo`}
          value={max}
          onChange={(e) => onMaxChange(clean(e.target.value))}
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {footer}
    </div>
  );
}

// Linha fina com "Opcionais" separando os campos não obrigatórios.
function OptionalDivider() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Opcionais
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

// Asterisco de campo obrigatório (legenda no topo da tela).
function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  );
}

function Step({
  number,
  title,
  required = false,
  description,
  children,
}: {
  number: number;
  title: string;
  required?: boolean;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex gap-3 sm:gap-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {number}
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">
            {title}
            {required && <> <RequiredMark /></>}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {/* No celular o conteúdo usa a largura toda (sem o recuo do número). */}
      <div className="min-w-0 sm:pl-12">{children}</div>
    </section>
  );
}

function DivisionCard({
  criterionKey,
  prompt,
  manageLabel,
  onManage,
  info,
  note,
  children,
}: {
  criterionKey: CategoryCriterionKey;
  prompt: string;
  manageLabel?: string;
  onManage: () => void;
  info: string | null;
  // Linha fixa embaixo da descrição (ex.: data de referência da idade).
  note?: string | null;
  children: ReactNode;
}) {
  const { icon: Icon, tone } = CRITERION_STYLE[criterionKey];
  return (
    <div className="grid gap-3 rounded-lg border border-border/60 p-3 sm:p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
        <div className="flex items-start gap-3">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", tone)}>
            <Icon className="size-5" />
          </span>
          <div className="grid min-w-0 flex-1 justify-items-start gap-1">
            <div>
              <p className="font-medium text-foreground">
                {CRITERION_LABELS[criterionKey]}
                {(criterionKey === "level" || criterionKey === "gender") && (
                  <> <RequiredMark /></>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{prompt}</p>
              {note && <p className="mt-1 text-xs font-medium text-foreground">{note}</p>}
            </div>
            {manageLabel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onManage}
                className="mt-1 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <Settings2 data-icon="inline-start" />
                {manageLabel}
              </Button>
            )}
          </div>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
      {info && (
        <div className="flex items-start gap-2 rounded-md bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
          {info}
        </div>
      )}
    </div>
  );
}

function MultiChoice({
  options,
  selected,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
}: {
  options: ChoiceOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onAdd: () => void;
  onEdit: (optionId: string) => void;
  onDelete: (optionId: string, label: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <div key={option.value} className="relative min-w-0">
            <button
              type="button"
              onClick={() => onToggle(option.value)}
              aria-pressed={active}
              className={cn(
                "flex min-h-9 w-full min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors",
                option.editableId && "pr-16",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-input",
                )}
              >
                {active && <Check className="size-3" />}
              </span>
              <span className="grid min-w-0">
                <span className="truncate">{option.label}</span>
                {option.hint && (
                  <span className="truncate text-xs text-muted-foreground">{option.hint}</span>
                )}
              </span>
            </button>
            {option.editableId && (
              <OwnOptionActions
                label={option.label}
                onEdit={() => onEdit(option.editableId as string)}
                onDelete={() => onDelete(option.editableId as string, option.label)}
                className="absolute top-1/2 right-1 -translate-y-1/2"
              />
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="flex min-h-9 items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
      >
        <Plus className="size-4" />
        Adicionar
      </button>
    </div>
  );
}

// Lápis e lixeira de uma opção criada pelo produtor (as padrão não têm).
function OwnOptionActions({
  label,
  onEdit,
  onDelete,
  className,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}) {
  const base =
    "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted";
  return (
    <div className={cn("flex items-center", className)}>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Editar ${label}`}
        title="Editar opção"
        className={cn(base, "hover:text-primary")}
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Excluir ${label}`}
        title="Excluir opção"
        className={cn(base, "hover:text-destructive")}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

const NONE = "__none__";
const ADD = "__add__";

function SingleChoice({
  options,
  value,
  allowNone,
  onChange,
  onAdd,
  onEdit,
  onDelete,
}: {
  options: ChoiceOption[];
  value: string | null;
  // Nível é obrigatório: sem "Não usar".
  allowNone: boolean;
  onChange: (value: string | null) => void;
  onAdd: () => void;
  onEdit: (optionId: string) => void;
  onDelete: (optionId: string, label: string) => void;
}) {
  const current = options.find((o) => o.value === value);
  const editable = current?.editableId ?? null;
  return (
    <div className="flex items-center gap-1">
    <Select
      value={value ?? (allowNone ? NONE : null)}
      onValueChange={(next) => {
        if (next === ADD) onAdd();
        else onChange(next === NONE ? null : (next as string));
      }}
    >
      <SelectTrigger className="w-full min-w-0">
        <SelectValue>
          {(current: string | null) =>
            !current
              ? "Selecione"
              : current === NONE
                ? "Não usar"
                : (options.find((o) => o.value === current)?.label ?? "Opção removida")
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>Não usar</SelectItem>}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
            {option.hint && (
              <span className="text-xs text-muted-foreground"> · {option.hint}</span>
            )}
          </SelectItem>
        ))}
        <SelectItem value={ADD}>+ Adicionar opção</SelectItem>
      </SelectContent>
    </Select>
      {editable && (
        <OwnOptionActions
          label={current?.label ?? "opção"}
          onEdit={() => onEdit(editable)}
          onDelete={() => onDelete(editable, current?.label ?? "opção")}
        />
      )}
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  tone,
  title,
  value,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="truncate font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

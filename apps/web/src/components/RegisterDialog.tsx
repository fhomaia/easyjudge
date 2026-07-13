import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, X } from "lucide-react";
import { cpf, cnpj } from "cpf-cnpj-validator";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { FormError } from "@/components/FormError";
import {
  authApi,
  ApiError,
  type DocumentType,
  type UserRole,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { formatCpf, formatCnpj } from "@/lib/masks";

const ROLE_LABELS: Record<UserRole, string> = {
  organization: "Produtor esportivo",
  judge: "Jurado",
  gym: "Ginásio",
  athlete: "Atleta",
};

// Cada item é uma "pergunta" da conversa. `summary` fecha a coleta de
// dados e dispara o /auth/register (que envia o email de confirmação);
// os passos depois disso (verify/password) não podem mais voltar, já
// que a conta pendente e o código já foram criados.
const STEPS = [
  "role",
  "firstName",
  "lastName",
  "document",
  "email",
  "team",
  "summary",
  "verify",
  "password",
] as const;
type StepKey = (typeof STEPS)[number];

const LOCKED_STEPS: StepKey[] = ["verify", "password"];

// Mesma regra do backend (common/validators/strong-password.validator.ts)
// — validada em tempo real aqui pra o usuário ver o erro assim que
// termina de digitar, sem precisar tentar enviar primeiro.
const PASSWORD_RULES: { key: string; label: string; test: (v: string) => boolean }[] = [
  { key: "length", label: "Mínimo 8 caracteres", test: (v) => v.length >= 8 },
  { key: "upper", label: "Uma letra maiúscula", test: (v) => /[A-Z]/.test(v) },
  { key: "number", label: "Um número", test: (v) => /\d/.test(v) },
  {
    key: "special",
    label: "Um caractere especial",
    test: (v) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v),
  },
];

function isPasswordStrong(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

// Opção de seleção única em formato "caixa ampla" (estilo Typeform):
// todas as opções visíveis ao mesmo tempo, sem dropdown escondendo nada.
// Sem bolinha de radio visível — a própria caixa já mostra o estado
// selecionado (borda + fundo azul), o indicador ficaria redundante.
function OptionCard({
  value,
  label,
  onSelect,
}: {
  value: string;
  label: string;
  onSelect?: () => void;
}) {
  return (
    <label
      onClick={(e) => {
        // O Base UI mantém um <input> nativo oculto (para semântica de
        // formulário) como irmão do <span role="radio">. Um clique em
        // qualquer ponto do label é encaminhado pelo navegador só a esse
        // input — filtramos por ele para reagir exatamente uma vez por
        // clique (o próprio <label> também recebe o bubble do clique
        // original, o que duplicaria a chamada se não filtrássemos).
        if (onSelect && (e.target as HTMLElement).tagName === "INPUT") {
          onSelect();
        }
      }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent bg-muted px-5 py-4 text-base font-medium text-foreground/70 transition-colors",
        "hover:bg-primary/10 hover:text-foreground",
        "has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/10 has-[[data-checked]]:text-foreground",
      )}
    >
      <RadioGroupItem value={value} className="sr-only" />
      {label}
    </label>
  );
}

const INITIAL_STATE = {
  role: "judge" as UserRole,
  documentType: "cpf" as DocumentType,
  firstName: "",
  lastName: "",
  documentNumber: "",
  email: "",
  teamOrInstitutionName: "",
  code: "",
  password: "",
  confirmPassword: "",
};

interface RegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -24 : 24, opacity: 0 }),
};

export function RegisterDialog({
  open,
  onOpenChange,
  onSuccess,
}: RegisterDialogProps) {
  const login = useAuthStore((s) => s.login);

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_STATE);

  const step: StepKey = STEPS[stepIndex];

  function update<K extends keyof typeof INITIAL_STATE>(
    key: K,
    value: (typeof INITIAL_STATE)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setStepIndex(0);
    setDirection(1);
    setError(null);
    setUserId(null);
    setForm(INITIAL_STATE);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function goNext() {
    setError(null);
    setDirection(1);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setDirection(-1);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function submitSimpleStep(e: FormEvent) {
    e.preventDefault();
    goNext();
  }

  function submitDocument(e: FormEvent) {
    e.preventDefault();
    const digits = form.documentNumber.replace(/\D/g, "");
    const valid =
      form.documentType === "cpf" ? cpf.isValid(digits) : cnpj.isValid(digits);
    if (!valid) {
      setError(form.documentType === "cpf" ? "CPF inválido." : "CNPJ inválido.");
      return;
    }
    goNext();
  }

  async function submitSummary() {
    setError(null);
    setLoading(true);
    try {
      const { userId } = await authApi.register({
        role: form.role,
        firstName: form.firstName,
        lastName: form.lastName,
        documentType: form.documentType,
        documentNumber: form.documentNumber.replace(/\D/g, ""),
        email: form.email,
        teamOrInstitutionName: form.teamOrInstitutionName || undefined,
      });
      setUserId(userId);
      goNext();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível criar a conta.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitVerify(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    setLoading(true);
    try {
      await authApi.verifyEmail(userId, form.code);
      goNext();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Código inválido.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (!userId) return;
    setError(null);
    try {
      await authApi.resendCode(userId);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível reenviar o código.",
      );
    }
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!isPasswordStrong(form.password)) {
      setError("A senha ainda não atende todos os requisitos.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { accessToken } = await authApi.setPassword(
        userId,
        form.password,
        form.confirmPassword,
      );
      login(accessToken);
      handleOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível definir a senha.",
      );
    } finally {
      setLoading(false);
    }
  }

  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const canGoBack = stepIndex > 0 && !LOCKED_STEPS.includes(step);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-lg">
        <DialogTitle className="sr-only">Criar conta</DialogTitle>

        <div className="flex items-center gap-3">
          {canGoBack ? (
            <button
              type="button"
              onClick={goBack}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Voltar"
            >
              <ArrowLeft className="size-4" />
            </button>
          ) : (
            <span className="size-4" />
          )}
          <Progress value={progress} className="flex-1" />
        </div>

        <FormError message={error} />

        <div className="relative min-h-[340px] overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              {step === "role" && (
                <div className="grid gap-5">
                  <h3 className="text-xl font-medium">Qual será seu tipo de conta?</h3>
                  <RadioGroup
                    value={form.role}
                    onValueChange={(v) => {
                      update("role", v as UserRole);
                      goNext();
                    }}
                    className="grid gap-3"
                  >
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                      <OptionCard
                        key={r}
                        value={r}
                        label={ROLE_LABELS[r]}
                        onSelect={r === form.role ? goNext : undefined}
                      />
                    ))}
                  </RadioGroup>
                </div>
              )}

              {step === "firstName" && (
                <form onSubmit={submitSimpleStep} className="grid gap-5">
                  <h3 className="text-xl font-medium">Qual é o seu nome?</h3>
                  <Input
                    autoFocus
                    aria-label="Nome"
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                    required
                  />
                  <Button type="submit" className="w-full">
                    Continuar
                  </Button>
                </form>
              )}

              {step === "lastName" && (
                <form onSubmit={submitSimpleStep} className="grid gap-5">
                  <h3 className="text-xl font-medium">E o seu sobrenome?</h3>
                  <Input
                    autoFocus
                    aria-label="Sobrenome"
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                    required
                  />
                  <Button type="submit" className="w-full">
                    Continuar
                  </Button>
                </form>
              )}

              {step === "document" && (
                <form onSubmit={submitDocument} className="grid gap-5">
                  <h3 className="text-xl font-medium">Qual é o seu documento?</h3>
                  <RadioGroup
                    value={form.documentType}
                    onValueChange={(v) => {
                      const type = v as DocumentType;
                      update("documentType", type);
                      update(
                        "documentNumber",
                        type === "cpf"
                          ? formatCpf(form.documentNumber)
                          : formatCnpj(form.documentNumber),
                      );
                    }}
                    className="grid grid-cols-2 gap-3"
                  >
                    <OptionCard value="cpf" label="CPF" />
                    <OptionCard value="cnpj" label="CNPJ" />
                  </RadioGroup>
                  <Input
                    autoFocus
                    aria-label={form.documentType === "cpf" ? "CPF" : "CNPJ"}
                    placeholder={
                      form.documentType === "cpf"
                        ? "000.000.000-00"
                        : "00.000.000/0000-00"
                    }
                    value={form.documentNumber}
                    onChange={(e) =>
                      update(
                        "documentNumber",
                        form.documentType === "cpf"
                          ? formatCpf(e.target.value)
                          : formatCnpj(e.target.value),
                      )
                    }
                    required
                  />
                  <Button type="submit" className="w-full">
                    Continuar
                  </Button>
                </form>
              )}

              {step === "email" && (
                <form onSubmit={submitSimpleStep} className="grid gap-5">
                  <h3 className="text-xl font-medium">Qual é o seu email?</h3>
                  <Input
                    autoFocus
                    aria-label="Email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value.trim())}
                    required
                  />
                  <Button type="submit" className="w-full">
                    Continuar
                  </Button>
                </form>
              )}

              {step === "team" && (
                <form onSubmit={submitSimpleStep} className="grid gap-5">
                  <h3 className="text-xl font-medium">
                    Qual sua equipe ou instituição?{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </h3>
                  <Input
                    autoFocus
                    aria-label="Equipe ou instituição"
                    value={form.teamOrInstitutionName}
                    onChange={(e) => update("teamOrInstitutionName", e.target.value)}
                  />
                  <Button type="submit" className="w-full">
                    {form.teamOrInstitutionName ? "Continuar" : "Pular"}
                  </Button>
                </form>
              )}

              {step === "summary" && (
                <div className="grid gap-5">
                  <h3 className="text-xl font-medium">Confere se está tudo certo:</h3>
                  <dl className="grid gap-2 rounded-lg border p-3 text-sm">
                    <SummaryRow label="Papel" value={ROLE_LABELS[form.role]} />
                    <SummaryRow
                      label="Nome"
                      value={`${form.firstName} ${form.lastName}`}
                    />
                    <SummaryRow
                      label={form.documentType === "cpf" ? "CPF" : "CNPJ"}
                      value={form.documentNumber}
                    />
                    <SummaryRow label="Email" value={form.email} />
                    <SummaryRow
                      label="Equipe/instituição"
                      value={form.teamOrInstitutionName || "Não informado"}
                    />
                  </dl>
                  <Button
                    type="button"
                    disabled={loading}
                    className="w-full"
                    onClick={submitSummary}
                  >
                    {loading ? "Enviando..." : "Confirmar e criar conta"}
                  </Button>
                </div>
              )}

              {step === "verify" && (
                <form onSubmit={submitVerify} className="grid gap-5">
                  <h3 className="text-xl font-medium">
                    Enviamos um código pro seu email. Qual é?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Verifique <strong>{form.email}</strong>.
                  </p>
                  <Input
                    autoFocus
                    aria-label="Código de verificação"
                    inputMode="numeric"
                    maxLength={6}
                    value={form.code}
                    onChange={(e) => update("code", e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="justify-self-start text-sm text-brand-blue underline underline-offset-3 hover:text-brand-yellow"
                  >
                    Reenviar código
                  </button>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Verificando..." : "Confirmar"}
                  </Button>
                </form>
              )}

              {step === "password" && (
                <form onSubmit={submitPassword} className="grid gap-5">
                  <h3 className="text-xl font-medium">Agora, crie uma senha:</h3>

                  <div className="grid gap-2.5">
                    <Input
                      autoFocus
                      aria-label="Senha"
                      type="password"
                      value={form.password}
                      onChange={(e) => update("password", e.target.value)}
                      required
                    />
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {PASSWORD_RULES.map((rule) => {
                        const met = rule.test(form.password);
                        return (
                          <li
                            key={rule.key}
                            className={cn(
                              "flex items-center gap-1.5 text-sm",
                              met ? "text-emerald-600" : "text-muted-foreground",
                            )}
                          >
                            {met ? (
                              <Check className="size-3.5 shrink-0" />
                            ) : (
                              <X className="size-3.5 shrink-0" />
                            )}
                            {rule.label}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="grid gap-2.5">
                    <Input
                      aria-label="Confirmar senha"
                      type="password"
                      value={form.confirmPassword}
                      onChange={(e) => update("confirmPassword", e.target.value)}
                      placeholder="Confirmar senha"
                      required
                    />
                    {form.confirmPassword.length > 0 &&
                      form.confirmPassword !== form.password && (
                        <p className="text-sm text-destructive">
                          As senhas não coincidem.
                        </p>
                      )}
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      loading ||
                      !isPasswordStrong(form.password) ||
                      form.password !== form.confirmPassword
                    }
                    className="w-full"
                  >
                    {loading ? "Finalizando..." : "Finalizar cadastro"}
                  </Button>
                </form>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

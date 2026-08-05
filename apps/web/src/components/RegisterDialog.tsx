import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, X } from "lucide-react";
import { cpf, cnpj } from "cpf-cnpj-validator";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { FormError } from "@/components/FormError";
import { PasswordInput } from "@/components/PasswordInput";
import { DatePicker } from "@/components/DatePicker";
import { BrandBackdrop } from "@/components/BrandBackdrop";
import {
  authApi,
  ApiError,
  type DocumentType,
  type UserRole,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { formatCpf, formatCnpj } from "@/lib/masks";
import { getMaxBirthDate } from "@/lib/birthDate";
import { PASSWORD_RULES, isPasswordStrong } from "@/lib/passwordRules";
import {
  ROLE_LABELS,
  SIGNUP_ROLE_LABELS,
  type SignupRole,
} from "@/lib/roleLabels";

// "Espectador" some do enum de verdade: no fundo é role=athlete sem
// vínculo (ver roleLabels.ts) — só pula as etapas "team"/"programEmail"
// abaixo. Mantém a mesma ordem que já existia (Object.keys(ROLE_LABELS)),
// só acrescenta a opção nova no fim.
const SIGNUP_ROLE_ORDER: SignupRole[] = [
  ...(Object.keys(ROLE_LABELS) as UserRole[]),
  "spectator",
];

// Cada item é uma "pergunta" da conversa. `summary` fecha a coleta de
// dados e dispara o /auth/register (que envia o email de confirmação);
// os passos depois disso (verify/password) não podem mais voltar, já
// que a conta pendente e o código já foram criados.
const STEPS = [
  "role",
  "firstName",
  "lastName",
  "document",
  "birthDate",
  "email",
  "team",
  "programEmail",
  "summary",
  "verify",
  "password",
] as const;
type StepKey = (typeof STEPS)[number];

// "programEmail" só faz sentido pra role=athlete — pulado nos dois
// sentidos (goNext/goBack) pra quem não é atleta (nem espectador, que
// por definição não tem vínculo). "team" também não faz sentido pra
// espectador (que declara de propósito não ter equipe), pra atleta (o
// email do programa, coletado em "programEmail", já é suficiente — não
// faz sentido pedir os dois) nem pra programa (a etapa "firstName" já
// pede o nome do próprio programa/ginásio, perguntar de novo seria
// redundante). "lastName" também não faz sentido pra programa — é uma
// instituição, não uma pessoa com nome+sobrenome. "birthDate" só faz
// sentido pra quem usa CPF (pedido de LGPD) — nunca pra CNPJ. Pra
// atleta/espectador (só aceitam CPF, ver isOptionalCpfOnlyRole) sempre
// pergunta, mesmo que o documento em si tenha sido pulado — não faz
// sentido condicionar à presença do CPF quando o tipo já é sempre CPF
// pra esse grupo.
function isStepApplicable(
  key: StepKey,
  form: Pick<typeof INITIAL_STATE, "role" | "documentType">,
): boolean {
  const role = form.role;
  if (key === "programEmail") return role === "athlete";
  if (key === "team") {
    return role !== "spectator" && role !== "athlete" && role !== "program";
  }
  if (key === "lastName") return role !== "program";
  if (key === "birthDate") {
    if (isOptionalCpfOnlyRole(role)) return true;
    return form.documentType === "cpf";
  }
  return true;
}

// Atleta e espectador (que no fundo também é role=athlete, ver
// SIGNUP_ROLE_ORDER acima) só podem informar CPF, e de forma opcional —
// diferente dos demais papéis, que continuam com CPF/CNPJ obrigatório.
function isOptionalCpfOnlyRole(role: SignupRole): boolean {
  return role === "athlete" || role === "spectator";
}

const LOCKED_STEPS: StepKey[] = ["verify", "password"];

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
        "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent bg-muted px-5 py-4 text-base font-medium text-foreground/70 transition-colors short:py-2.5",
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
  role: "judge" as SignupRole,
  documentType: "cpf" as DocumentType,
  firstName: "",
  lastName: "",
  documentNumber: "",
  birthDate: "",
  email: "",
  teamOrInstitutionName: "",
  programEmail: "",
  acceptedTerms: false,
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
  // Token fica em espera até a animação do raio terminar (mesmo
  // raciocínio de LoginPage.pendingToken) — chamar `login()` cedo
  // demais faria o GuestRoute trocar pra Home (e ela começar a buscar
  // dados) enquanto o raio ainda está rodando aqui dentro do popup,
  // ainda aberto, disputando o mesmo thread principal.
  const [pendingToken, setPendingToken] = useState<string | null>(null);

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
    setPendingToken(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function goNext() {
    setError(null);
    setDirection(1);
    setStepIndex((i) => {
      let next = Math.min(i + 1, STEPS.length - 1);
      while (next < STEPS.length - 1 && !isStepApplicable(STEPS[next], form))
        next++;
      return next;
    });
  }

  function goBack() {
    setError(null);
    setDirection(-1);
    setStepIndex((i) => {
      let prev = Math.max(i - 1, 0);
      while (prev > 0 && !isStepApplicable(STEPS[prev], form)) prev--;
      return prev;
    });
  }

  function submitSimpleStep(e: FormEvent) {
    e.preventDefault();
    goNext();
  }

  function submitDocument(e: FormEvent) {
    e.preventDefault();
    const digits = form.documentNumber.replace(/\D/g, "");
    if (isOptionalCpfOnlyRole(form.role) && digits === "") {
      goNext();
      return;
    }
    const type = isOptionalCpfOnlyRole(form.role) ? "cpf" : form.documentType;
    const valid = type === "cpf" ? cpf.isValid(digits) : cnpj.isValid(digits);
    if (!valid) {
      setError(type === "cpf" ? "CPF inválido." : "CNPJ inválido.");
      return;
    }
    goNext();
  }

  async function submitSummary() {
    setError(null);
    setLoading(true);
    try {
      const documentDigits = form.documentNumber.replace(/\D/g, "");
      const { userId } = await authApi.register({
        // Espectador não existe pro backend — vira athlete comum, sem
        // equipe/vínculo (ver comentário de SIGNUP_ROLE_ORDER acima).
        role: form.role === "spectator" ? "athlete" : form.role,
        firstName: form.firstName,
        lastName: form.lastName,
        // Atleta/espectador podem ter pulado o documento (opcional, ver
        // isOptionalCpfOnlyRole) — nesse caso os dois campos vão undefined,
        // nunca um documentType solto sem número.
        documentType: documentDigits ? form.documentType : undefined,
        documentNumber: documentDigits || undefined,
        // Só coletado quando o passo "birthDate" foi de fato mostrado
        // (documentType === cpf, ver isStepApplicable) — para CNPJ ou
        // documento pulado, form.birthDate nunca chega a ser preenchido.
        birthDate: form.birthDate || undefined,
        email: form.email,
        teamOrInstitutionName: form.teamOrInstitutionName || undefined,
        programEmail:
          form.role === "athlete" ? form.programEmail || undefined : undefined,
        acceptedTerms: form.acceptedTerms,
      });
      setUserId(userId);
      goNext();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível criar a conta.",
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
      // `login()`/fechar o popup/onSuccess só acontecem depois da
      // animação (ver BrandBackdrop mais abaixo e completeRegistration)
      // — mesmo raciocínio de LoginPage.pendingToken.
      setPendingToken(accessToken);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível definir a senha.",
      );
      setLoading(false);
    }
  }

  async function completeRegistration() {
    if (!pendingToken) return;
    login(pendingToken);
    handleOpenChange(false);
    onSuccess();
  }

  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const canGoBack = stepIndex > 0 && !LOCKED_STEPS.includes(step);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="gap-7 p-10 short:gap-3 short:p-5 sm:max-w-lg">
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

          {/* Alguns passos (ex. "role", com 5 opções desde que "Espectador"
            foi acrescentado) ficam mais altos que um min-h fixo
            calibrado à mão — como os passos são posicionados via
            `absolute` (evita "pulo" de layout na troca de passo, ver
            comentário do AnimatePresence abaixo), a altura deste wrapper
            nunca é dirigida pelo conteúdo, então um passo mais alto que
            o min-h simplesmente transbordava.
            Overflow SEMPRE visível (não só em telas baixas): tentamos
            manter overflow-hidden fora do modo "short" com um min-h
            recalibrado à mão pro passo "role" (primeiro 340px, depois
            400px) — quebrou de novo em produção porque a métrica de
            fonte real do Android rende cada OptionCard um pouco mais
            alto que no Chrome desktop usado pra medir o número (a
            última opção aparecia com o padding inferior cortado,
            mesmo com margem de sobra no teste local). Em vez de caçar
            um número mágico pra sempre certo em qualquer fonte/
            plataforma, deixamos o overflow visível em QUALQUER altura
            — o excesso, se houver, vira scroll do <Dialog> (que já tem
            overflow-y-auto), sem depender de nenhum número exato. min-h
            aqui (400px fora do modo short, 200px dentro) continua só
            como tamanho BASE de referência pros passos mais simples —
            não precisa mais ser exato, overflow-visible cobre qualquer
            diferença.
            <DialogPrimitive.Popup> (dialog.tsx) é `display: grid` +
            `overflow-y-auto` — um comportamento conhecido do CSS faz o
            padding-bottom do PRÓPRIO container de scroll não ser
            respeitado no fim do scroll (grid/flex "esquecem" o
            end-padding do scroll container, ver
            github.com/w3c/csswg-drafts/issues/129) — sem um spacer
            próprio, o último item de um passo que precisa rolar fica
            exatamente rente à borda arredondada do popup. Um spacer como
            IRMÃO deste wrapper (depois dele, ainda dentro do Popup) NÃO
            funciona: a posição desse irmão no fluxo normal segue a
            altura PRÓPRIA deste wrapper (min-h), não o conteúdo
            absolutamente posicionado que transborda por cima dele — o
            spacer acaba "enterrado" dentro da zona de overflow, não
            depois dela. O fix de verdade precisa ficar DENTRO do passo
            (filho real do próprio conteúdo do passo, depois do último
            elemento de verdade) — só assim ele conta pra altura
            intrínseca do passo, que é o que de fato transborda e chega
            no scrollHeight do Popup. Ver o spacer no fim do "role"
            abaixo (o único passo alto o bastante pra precisar). */}
          <div className="relative min-h-[400px] overflow-visible short:min-h-[200px]">
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
                  <div className="grid gap-5 short:gap-3">
                    <h3 className="text-xl font-medium short:text-lg">
                      Qual será seu tipo de conta?
                    </h3>
                    <RadioGroup
                      value={form.role}
                      onValueChange={(v) => {
                        const role = v as SignupRole;
                        update("role", role);
                        // Se o usuário já tinha escolhido CNPJ (ex.: veio de
                        // "Programa") e volta pra trocar pra atleta/espectador,
                        // força de volta pra CPF — os únicos aceitos aqui.
                        if (isOptionalCpfOnlyRole(role)) {
                          update("documentType", "cpf");
                        }
                        goNext();
                      }}
                      className="grid gap-3"
                    >
                      {SIGNUP_ROLE_ORDER.map((r) => (
                        <OptionCard
                          key={r}
                          value={r}
                          label={SIGNUP_ROLE_LABELS[r]}
                          onSelect={r === form.role ? goNext : undefined}
                        />
                      ))}
                    </RadioGroup>
                    {/* Sempre presente (não só em paisagem) — ver comentário
                      do wrapper acima. Precisa estar AQUI (filho real do
                      próprio passo, depois do RadioGroup), não como
                      irmão do wrapper lá fora. */}
                    <div aria-hidden className="h-4" />
                  </div>
                )}

                {step === "firstName" && (
                  <form
                    onSubmit={submitSimpleStep}
                    className="grid gap-5 short:gap-3"
                  >
                    <h3 className="text-xl font-medium short:text-lg">
                      {form.role === "program"
                        ? "Qual o nome do seu programa/ginásio?"
                        : "Qual é o seu nome?"}
                    </h3>
                    <Input
                      autoFocus
                      aria-label={
                        form.role === "program"
                          ? "Nome do programa/ginásio"
                          : "Nome"
                      }
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
                  <form
                    onSubmit={submitSimpleStep}
                    className="grid gap-5 short:gap-3"
                  >
                    <h3 className="text-xl font-medium short:text-lg">
                      E o seu sobrenome?
                    </h3>
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
                  <form
                    onSubmit={submitDocument}
                    className="grid gap-5 short:gap-3"
                  >
                    <h3 className="text-xl font-medium short:text-lg">
                      {isOptionalCpfOnlyRole(form.role) ? (
                        <>
                          Qual é o seu CPF?{" "}
                          <span className="text-sm font-normal text-muted-foreground">
                            (opcional)
                          </span>
                        </>
                      ) : (
                        "Qual é o seu documento?"
                      )}
                    </h3>
                    {!isOptionalCpfOnlyRole(form.role) && (
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
                    )}
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
                      required={!isOptionalCpfOnlyRole(form.role)}
                    />
                    <Button type="submit" className="w-full">
                      {isOptionalCpfOnlyRole(form.role) &&
                      form.documentNumber === ""
                        ? "Pular"
                        : "Continuar"}
                    </Button>
                  </form>
                )}

                {step === "birthDate" && (
                  <form
                    onSubmit={submitSimpleStep}
                    className="grid gap-5 short:gap-3"
                  >
                    <h3 className="text-xl font-medium short:text-lg">
                      Qual é a sua data de nascimento?
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      A Cheer Cup ainda não aceita cadastro de menores de 13
                      anos.
                    </p>
                    <DatePicker
                      id="birthDate"
                      value={form.birthDate}
                      onChange={(v) => update("birthDate", v)}
                      placeholder="Selecione a data de nascimento"
                      captionLayout="dropdown"
                      startMonth={
                        new Date(new Date().getFullYear() - 100, 0, 1)
                      }
                      endMonth={getMaxBirthDate()}
                      maxDate={getMaxBirthDate()}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={!form.birthDate}
                    >
                      Continuar
                    </Button>
                  </form>
                )}

                {step === "email" && (
                  <form
                    onSubmit={submitSimpleStep}
                    className="grid gap-5 short:gap-3"
                  >
                    <h3 className="text-xl font-medium short:text-lg">
                      Qual é o seu email?
                    </h3>
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
                  <form
                    onSubmit={submitSimpleStep}
                    className="grid gap-5 short:gap-3"
                  >
                    <h3 className="text-xl font-medium short:text-lg">
                      Qual sua equipe ou instituição?{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        (opcional)
                      </span>
                    </h3>
                    <Input
                      autoFocus
                      aria-label="Equipe ou instituição"
                      value={form.teamOrInstitutionName}
                      onChange={(e) =>
                        update("teamOrInstitutionName", e.target.value)
                      }
                    />
                    <Button type="submit" className="w-full">
                      {form.teamOrInstitutionName ? "Continuar" : "Pular"}
                    </Button>
                  </form>
                )}

                {step === "programEmail" && (
                  <form
                    onSubmit={submitSimpleStep}
                    className="grid gap-5 short:gap-3"
                  >
                    <h3 className="text-xl font-medium short:text-lg">
                      Qual o email do seu programa?{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        (opcional)
                      </span>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Pedimos o vínculo com ele — precisa ser confirmado depois.
                      Dá pra pular e vincular mais tarde, em &quot;Meus
                      programas&quot;.
                    </p>
                    <Input
                      autoFocus
                      type="email"
                      aria-label="Email do programa"
                      value={form.programEmail}
                      onChange={(e) =>
                        update("programEmail", e.target.value.trim())
                      }
                    />
                    <Button type="submit" className="w-full">
                      {form.programEmail ? "Continuar" : "Pular"}
                    </Button>
                  </form>
                )}

                {step === "summary" && (
                  <div className="grid gap-5 short:gap-3">
                    <h3 className="text-xl font-medium short:text-lg">
                      Confere se está tudo certo:
                    </h3>
                    <dl className="grid gap-2 rounded-lg border p-3 text-sm">
                      <SummaryRow
                        label="Papel"
                        value={SIGNUP_ROLE_LABELS[form.role]}
                      />
                      <SummaryRow
                        label="Nome"
                        value={`${form.firstName} ${form.lastName}`.trim()}
                      />
                      <SummaryRow
                        label={form.documentType === "cpf" ? "CPF" : "CNPJ"}
                        value={form.documentNumber || "Não informado"}
                      />
                      {form.birthDate && (
                        <SummaryRow
                          label="Data de nascimento"
                          value={format(
                            parseISO(form.birthDate),
                            "dd/MM/yyyy",
                            { locale: ptBR },
                          )}
                        />
                      )}
                      <SummaryRow label="Email" value={form.email} />
                      {form.role !== "spectator" && form.role !== "athlete" && (
                        <SummaryRow
                          label="Equipe/instituição"
                          value={form.teamOrInstitutionName || "Não informado"}
                        />
                      )}
                      {form.role === "athlete" && (
                        <SummaryRow
                          label="Email do programa"
                          value={form.programEmail || "Não informado"}
                        />
                      )}
                    </dl>
                    <label className="flex items-start gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={form.acceptedTerms}
                        onCheckedChange={(value) =>
                          update("acceptedTerms", value === true)
                        }
                        className="mt-0.5"
                      />
                      <span>
                        Li e concordo com os{" "}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-brand-blue underline underline-offset-2 hover:text-brand-yellow"
                        >
                          Termos de Uso
                        </a>{" "}
                        e a{" "}
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-brand-blue underline underline-offset-2 hover:text-brand-yellow"
                        >
                          Política de Privacidade
                        </a>
                        .
                      </span>
                    </label>
                    <Button
                      type="button"
                      disabled={loading || !form.acceptedTerms}
                      className="w-full"
                      onClick={submitSummary}
                    >
                      {loading ? "Enviando..." : "Confirmar e criar conta"}
                    </Button>
                  </div>
                )}

                {step === "verify" && (
                  <form
                    onSubmit={submitVerify}
                    className="grid gap-5 short:gap-3"
                  >
                    <h3 className="text-xl font-medium short:text-lg">
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
                  <form
                    onSubmit={submitPassword}
                    className="grid gap-5 short:gap-3"
                  >
                    <h3 className="text-xl font-medium short:text-lg">
                      Agora, crie uma senha:
                    </h3>

                    <div className="grid gap-2.5">
                      <PasswordInput
                        autoFocus
                        aria-label="Senha"
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
                                met
                                  ? "text-emerald-600"
                                  : "text-muted-foreground",
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
                      <PasswordInput
                        aria-label="Confirmar senha"
                        value={form.confirmPassword}
                        onChange={(e) =>
                          update("confirmPassword", e.target.value)
                        }
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

      {/* Só toca DEPOIS que o password foi definido (pendingToken) — o
        popup continua aberto por trás enquanto o raio cobre a tela
        inteira; login()/fechar o popup só acontecem no onDone (ver
        completeRegistration acima). Mesmo raciocínio de
        LoginPage.pendingToken: chamar login() cedo demais faria o
        GuestRoute trocar pra Home enquanto a animação ainda roda,
        competindo pelo mesmo thread principal. z-[60] (não z-50, igual
        ao Dialog) garante que fica por cima do popup mesmo se a ordem
        de portal do Base UI colocar os dois no mesmo nível. */}
      {pendingToken && (
        <BrandBackdrop
          variant="plain"
          className="z-[60]"
          onDone={() => void completeRegistration()}
        />
      )}
    </>
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

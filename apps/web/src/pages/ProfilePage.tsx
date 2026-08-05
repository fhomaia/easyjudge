import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Camera, ChevronRight, KeyRound, Power, Trash2 } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/DatePicker";
import { FormError } from "@/components/FormError";
import { PasswordInput } from "@/components/PasswordInput";
import { formatCpf, formatCnpj } from "@/lib/masks";
import { getMaxBirthDate } from "@/lib/birthDate";
import { getAccountLabel } from "@/lib/roleLabels";
import { usersApi, ApiError, type UserProfile } from "@/api/client";
import { useAuthStore } from "@/store/auth";

function getUserInitials(profile: UserProfile): string {
  return `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();
}

// Cada seção do formulário (nome, documento, data de nascimento, senha)
// tem estado/loading/erro independentes — mais simples do que um form
// gigante único, e cada uma some quando não se aplica (ex: documento já
// preenchido vira texto estático, não input).
export function ProfilePage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usersApi
      .me()
      .then(setProfile)
      .catch(() => navigate("/", { replace: true }));
  }, [navigate]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-svh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto pt-14 sm:pt-0">
        <div className="w-full px-6 py-10 sm:px-10 lg:px-16">
          <h1 className="text-2xl font-semibold text-foreground">Meu perfil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie seus dados pessoais e sua conta.
          </p>

          {profile && (
            <div className="mt-8 grid gap-6">
              <AvatarSection
                profile={profile}
                onUpdated={setProfile}
                fileInputRef={fileInputRef}
              />

              <PersonalInfoCard profile={profile} onUpdated={setProfile} />

              {/* Documento/Data de nascimento AINDA NÃO preenchidos
                  ficam em cards próprios, como antes — são fluxo de
                  preencher uma vez (com texto explicativo e botão
                  próprio), diferente da edição normal de "Dados
                  pessoais". Assim que preenchidos, o valor passa a
                  aparecer dentro do card único acima. Largura cheia
                  (não 2 colunas) — cada card já tem um formulário
                  inteiro dentro, ficaria apertado dividindo a largura. */}
              <DocumentCard profile={profile} onUpdated={setProfile} />
              <BirthDateCard profile={profile} onUpdated={setProfile} />

              <PasswordSection />

              <AccountStatusSection onLogout={handleLogout} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-6">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function AvatarSection({
  profile,
  onUpdated,
  fileInputRef,
}: {
  profile: UserProfile;
  onUpdated: (p: UserProfile) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      onUpdated(await usersApi.uploadAvatar(file));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setLoading(true);
    try {
      onUpdated(await usersApi.removeAvatar());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-yellow text-lg font-semibold text-brand-navy">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          getUserInitials(profile)
        )}
      </div>
      <div className="grid gap-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera data-icon="inline-start" />
            Alterar foto
          </Button>
          {profile.avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={handleRemove}
            >
              <Trash2 data-icon="inline-start" />
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {getAccountLabel(profile)}
        </p>
        <FormError message={error} />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

// Nome sempre vive aqui; Documento/Data de nascimento só entram neste
// card único depois de já terem um valor definido (exibição estática)
// — enquanto em branco, o formulário de preencher fica num card à
// parte (ver DocumentCard/BirthDateCard abaixo), pedido do usuário.
function PersonalInfoCard({
  profile,
  onUpdated,
}: {
  profile: UserProfile;
  onUpdated: (p: UserProfile) => void;
}) {
  return (
    <Card title="Dados pessoais">
      <div className="grid gap-6">
        <NameFields profile={profile} onUpdated={onUpdated} />
        {profile.documentNumber && (
          <div className="grid gap-2 border-t border-border/60 pt-6">
            <h3 className="text-sm font-semibold text-foreground">
              {profile.documentType === "cnpj" ? "Documento (CNPJ)" : "Documento (CPF)"}
            </h3>
            <p className="text-sm text-foreground">
              {profile.documentType === "cnpj"
                ? formatCnpj(profile.documentNumber)
                : formatCpf(profile.documentNumber)}
            </p>
          </div>
        )}
        {profile.birthDate && (
          <div className="grid gap-2 border-t border-border/60 pt-6">
            <h3 className="text-sm font-semibold text-foreground">
              Data de nascimento
            </h3>
            <p className="text-sm text-foreground">
              {format(parseISO(profile.birthDate), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function NameFields({
  profile,
  onUpdated,
}: {
  profile: UserProfile;
  onUpdated: (p: UserProfile) => void;
}) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      onUpdated(await usersApi.updateProfile({ firstName, lastName }));
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  const isProgram = profile.role === "program";

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="profile-email">Email</Label>
        {/* Somente leitura — trocar email não entrou no escopo desta
            tela (exigiria reabrir o mesmo fluxo de verificação por
            código do cadastro), ver conversa que definiu esta
            página. */}
        <Input id="profile-email" value={profile.email} disabled />
      </div>
      <div className={isProgram ? "grid gap-2" : "grid gap-4 sm:grid-cols-2"}>
        <div className="grid gap-2">
          <Label htmlFor="profile-first-name">
            {isProgram ? "Nome do programa/ginásio" : "Nome"}
          </Label>
          <Input
            id="profile-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        {!isProgram && (
          <div className="grid gap-2">
            <Label htmlFor="profile-last-name">Sobrenome</Label>
            <Input
              id="profile-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        )}
      </div>

      <FormError message={error} />
      {saved && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Salvo.
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-fit">
        {loading ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}

// Card próprio, visível só enquanto profile.documentNumber ainda não
// tem valor — some sozinho (via onUpdated) assim que salvo, e o valor
// passa a aparecer dentro de PersonalInfoCard.
function DocumentCard({
  profile,
  onUpdated,
}: {
  profile: UserProfile;
  onUpdated: (p: UserProfile) => void;
}) {
  const [documentNumber, setDocumentNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      onUpdated(
        await usersApi.updateProfile({
          documentType: "cpf",
          documentNumber: documentNumber.replace(/\D/g, ""),
        }),
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (profile.documentNumber) return null;

  // Preenchimento tardio é exclusivo de atleta — é o único papel que
  // pode ter deixado documento em branco no cadastro (ver RegisterDto).
  // Pra qualquer outro papel sem documentNumber (não deveria acontecer,
  // documento é obrigatório na validação de registro), mostra só texto,
  // sem formulário — não temos como saber se seria CPF ou CNPJ.
  const canFill = profile.role === "athlete";

  return (
    <Card
      title={
        profile.documentType === "cnpj" ? "Documento (CNPJ)" : "Documento (CPF)"
      }
    >
      {canFill ? (
        <form onSubmit={handleSubmit} className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Você não informou CPF no cadastro. Pode preencher agora — depois de
            salvo, não dá mais pra alterar por aqui.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="profile-document">CPF</Label>
            <Input
              id="profile-document"
              value={formatCpf(documentNumber)}
              onChange={(e) =>
                setDocumentNumber(e.target.value.replace(/\D/g, ""))
              }
              placeholder="000.000.000-00"
              required
            />
          </div>
          <FormError message={error} />
          <Button type="submit" disabled={loading} className="w-fit">
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Não informado.</p>
      )}
    </Card>
  );
}

// Mesma lógica de DocumentCard, pra data de nascimento.
function BirthDateCard({
  profile,
  onUpdated,
}: {
  profile: UserProfile;
  onUpdated: (p: UserProfile) => void;
}) {
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      onUpdated(await usersApi.updateProfile({ birthDate }));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Instituição (CNPJ) nunca coleta data de nascimento no cadastro (não
  // se aplica) — sem valor salvo, o card nem faz sentido de existir.
  if (profile.birthDate || profile.documentType === "cnpj") return null;

  return (
    <Card title="Data de nascimento">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Depois de salva não será possível alterar a data de nascimento
          novamente.
        </p>
        <DatePicker
          id="profile-birth-date"
          value={birthDate}
          onChange={setBirthDate}
          placeholder="Selecione a data de nascimento"
          captionLayout="dropdown"
          startMonth={new Date(new Date().getFullYear() - 100, 0, 1)}
          endMonth={getMaxBirthDate()}
          maxDate={getMaxBirthDate()}
        />
        <FormError message={error} />
        <Button type="submit" disabled={loading || !birthDate} className="w-fit">
          {loading ? "Salvando..." : "Salvar"}
        </Button>
      </form>
    </Card>
  );
}

function PasswordSection() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-6 text-left transition-colors hover:bg-accent/50"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <KeyRound className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Trocar senha</p>
          <p className="text-xs text-muted-foreground">
            Altere a senha da sua conta.
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <ChangePasswordDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
      setSaved(false);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      await usersApi.changePassword(
        currentPassword,
        newPassword,
        confirmPassword,
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">
            Trocar senha
          </DialogTitle>
          <DialogDescription>
            Informe sua senha atual e a nova senha.
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="profile-current-password">Senha atual</Label>
            <PasswordInput
              id="profile-current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-new-password">Nova senha</Label>
            <PasswordInput
              id="profile-new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-confirm-password">
              Confirmar nova senha
            </Label>
            <PasswordInput
              id="profile-confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <FormError message={error} />
          {saved && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              Senha alterada.
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Salvando..." : "Trocar senha"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Desativar (reversível, basta logar de novo) e excluir (irreversível,
// dados pessoais anonimizados — ver PrivacyPolicyPage/TermsOfUsePage)
// a conta. `onLogout` é o mesmo handler usado pelo botão "Sair" da
// sidebar — as duas ações precisam derrubar a sessão local do mesmo
// jeito, já que o token deixa de funcionar no backend de qualquer forma
// (JwtStrategy passa a rejeitar contas !active a cada request).
function AccountStatusSection({ onLogout }: { onLogout: () => void }) {
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setDeactivateOpen(true)}
        className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-6 text-left transition-colors hover:bg-accent/50"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Power className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Desativar conta
          </p>
          <p className="text-xs text-muted-foreground">
            Pausa sua conta temporariamente. Você volta fazendo login de novo.
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-card p-6 text-left transition-colors hover:bg-destructive/5"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Trash2 className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-destructive">
            Excluir conta
          </p>
          <p className="text-xs text-muted-foreground">
            Apaga seus dados pessoais permanentemente. Não pode ser desfeito.
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <DeactivateAccountDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        onDeactivated={onLogout}
      />
      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onLogout}
      />
    </>
  );
}

function DeactivateAccountDialog({
  open,
  onOpenChange,
  onDeactivated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeactivated: () => void;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setPassword("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await usersApi.deactivateAccount(password);
      onDeactivated();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Erro inesperado. Tente novamente.",
      );
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">
            Desativar conta
          </DialogTitle>
          <DialogDescription>
            Você poderá voltar quando quiser, basta fazer login de novo com
            seu email e senha. Confirme sua senha atual para continuar.
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="deactivate-password">Senha atual</Label>
            <PasswordInput
              id="deactivate-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <FormError message={error} />

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Desativando..." : "Desativar conta"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAccountDialog({
  open,
  onOpenChange,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setPassword("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await usersApi.deleteAccount(password);
      onDeleted();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Erro inesperado. Tente novamente.",
      );
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium text-destructive">
            Excluir conta
          </DialogTitle>
          <DialogDescription>
            Essa ação não pode ser desfeita. Seus dados pessoais são
            apagados; notas e registros de eventos em que você participou
            continuam preservados, sem o seu nome, para manter o histórico
            oficial da competição. Confirme sua senha atual para continuar.
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="delete-account-password">Senha atual</Label>
            <PasswordInput
              id="delete-account-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <FormError message={error} />

          <Button
            type="submit"
            variant="destructive"
            disabled={loading}
            className="w-full"
          >
            {loading ? "Excluindo..." : "Excluir conta"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

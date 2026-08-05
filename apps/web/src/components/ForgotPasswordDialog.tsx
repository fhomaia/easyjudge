import { useState, type FormEvent } from "react";
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/FormError";
import { PasswordInput } from "@/components/PasswordInput";
import { PASSWORD_RULES, isPasswordStrong } from "@/lib/passwordRules";
import { cn } from "@/lib/utils";
import { authApi, ApiError } from "@/api/client";

type Step = "email" | "code" | "password";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResetSuccess: () => void;
}

// Mesmo popup em cima da LoginPage (fundo/BrandBackdrop compartilhado,
// sem navegação pra rota própria) — pedido do usuário, mesmo padrão já
// usado por RegisterDialog pro cadastro. Fluxo em 3 etapas, sempre com a
// mesma UX independente do email existir ou não na base —
// POST /auth/forgot-password nunca revela isso (ver
// AuthService.forgotPassword), então a etapa "email" sempre avança pra
// "código" com a mesma mensagem genérica.
export function ForgotPasswordDialog({
  open,
  onOpenChange,
  onResetSuccess,
}: ForgotPasswordDialogProps) {
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [resetId, setResetId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function reset() {
    setStep("email");
    setLoading(false);
    setError(null);
    setEmail("");
    setResetId(null);
    setCode("");
    setPassword("");
    setConfirmPassword("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { resetId } = await authApi.forgotPassword(email);
      setResetId(resetId);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!resetId) return;
    setError(null);
    setLoading(true);
    try {
      await authApi.verifyPasswordReset(resetId, code);
      setStep("password");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetId) return;
    setError(null);
    setLoading(true);
    try {
      await authApi.resetPassword(resetId, password, confirmPassword);
      handleOpenChange(false);
      onResetSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-6 p-8 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Esqueceu sua senha?</DialogTitle>
          <DialogDescription>
            {step === "email" && "Informe seu email para redefinir sua senha."}
            {step === "code" && "Digite o código de 6 dígitos enviado por email."}
            {step === "password" && "Agora, defina sua nova senha."}
          </DialogDescription>
        </div>

        <FormError message={error} />

        {step === "email" && (
          <form onSubmit={submitEmail} className="grid gap-5">
            <div className="grid gap-2.5">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Enviando..." : "Enviar código"}
            </Button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={submitCode} className="grid gap-5">
            <p className="text-sm text-muted-foreground">
              Se o email <strong className="text-foreground">{email}</strong> tiver
              cadastro na Cheer Cup, você vai receber um código de verificação em
              instantes.
            </p>
            <div className="grid gap-2.5">
              <Label htmlFor="forgot-code">Código</Label>
              <Input
                id="forgot-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
              {loading ? "Confirmando..." : "Confirmar código"}
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => {
                setError(null);
                setCode("");
                setStep("email");
              }}
            >
              Usar outro email
            </Button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={submitPassword} className="grid gap-5">
            <div className="grid gap-2.5">
              <Label htmlFor="forgot-password">Nova senha</Label>
              <PasswordInput
                id="forgot-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(password);
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
              <Label htmlFor="forgot-confirm-password">Confirmar nova senha</Label>
              <PasswordInput
                id="forgot-confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <p className="text-sm text-destructive">As senhas não coincidem.</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={
                loading || !isPasswordStrong(password) || password !== confirmPassword
              }
              className="w-full"
            >
              {loading ? "Salvando..." : "Redefinir senha"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

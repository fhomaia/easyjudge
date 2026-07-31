import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/FormError";
import { RegisterDialog } from "@/components/RegisterDialog";
import { BrandBackdrop } from "@/components/BrandBackdrop";
import { consumePendingJoinCode } from "@/lib/pendingJoinCode";
import { authApi, eventsApi, ApiError } from "@/api/client";
import { useAuthStore } from "@/store/auth";

// Se o usuário chegou aqui vindo de um /join/:code (ver JoinEventPage)
// enquanto deslogado, o código ficou guardado — resgata (melhor
// esforço, erro é ignorado: o login/cadastro já aconteceu de qualquer
// forma) antes de ir pra Home, onde o evento já aparece na lista.
async function joinPendingEventIfAny() {
  const code = consumePendingJoinCode();
  if (!code) return;
  try {
    await eventsApi.joinByCode(code);
  } catch {
    // melhor esforço — código inválido/expirado não deve travar o login
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { accessToken } = await authApi.login(email, password);
      login(accessToken);
      await joinPendingEventIfAny();
      navigate("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível entrar.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-x-hidden overflow-y-auto p-6 short:p-3">
      <BrandBackdrop />

      <motion.div
        className="relative w-full max-w-sm sm:max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5, ease: "easeOut" }}
      >
        <Card className="w-full gap-0 border-none py-6 shadow-2xl shadow-black/10 [--card-spacing:--spacing(6)] sm-tall:py-10 sm-tall:[--card-spacing:--spacing(10)] short:py-3 short:[--card-spacing:--spacing(3)]">
          <CardHeader className="justify-items-center gap-3 text-center sm-tall:gap-5 short:gap-1">
            <img
              src="/logo.png"
              alt="Cheer Cup"
              className="mx-auto w-full max-w-[110px] rounded-full sm-tall:max-w-[150px] short:max-w-[64px]"
            />
            <CardDescription className="text-sm sm-tall:text-base short:hidden">
              Entre na sua conta para continuar.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="grid gap-4 pt-5 sm-tall:gap-6 sm-tall:pt-8 short:gap-2 short:pt-2">
              <FormError message={error} />
              <div className="grid gap-2.5 short:gap-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="short:h-9"
                  required
                />
              </div>
              <div className="grid gap-2.5 short:gap-1">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="short:h-9"
                  required
                />
              </div>
            </CardContent>
            <div className="grid gap-3 px-(--card-spacing) pt-2 pb-(--card-spacing) sm-tall:gap-4 short:gap-1 short:pt-1">
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button type="submit" disabled={loading} className="w-full short:h-9">
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </motion.div>
              <Button
                type="button"
                variant="link"
                onClick={() => setRegisterOpen(true)}
                className="short:h-9"
              >
                Criar conta
              </Button>
            </div>
          </form>
        </Card>
      </motion.div>

      <RegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onSuccess={() => {
          void joinPendingEventIfAny().then(() => navigate("/"));
        }}
      />
    </div>
  );
}

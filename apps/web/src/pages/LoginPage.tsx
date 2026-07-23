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
import { authApi, ApiError } from "@/api/client";
import { useAuthStore } from "@/store/auth";

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
    <div className="relative flex min-h-svh items-center justify-center overflow-x-hidden overflow-y-auto p-4">
      <BrandBackdrop />

      <motion.div
        className="relative w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5, ease: "easeOut" }}
      >
        <Card className="w-full gap-0 border-none py-10 shadow-2xl shadow-black/10 [--card-spacing:--spacing(10)] short:py-4 short:[--card-spacing:--spacing(4)]">
          <CardHeader className="justify-items-center gap-5 text-center short:gap-2">
            <img
              src="/logo.png"
              alt="easyJudge"
              className="mx-auto w-full max-w-[220px] short:max-w-[130px]"
            />
            <CardDescription className="text-base short:hidden">
              Entre na sua conta para continuar.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="grid gap-6 pt-8 short:gap-3 short:pt-4">
              <FormError message={error} />
              <div className="grid gap-2.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <div className="grid gap-4 px-(--card-spacing) pt-2 pb-(--card-spacing) short:gap-2">
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </motion.div>
              <Button
                type="button"
                variant="link"
                onClick={() => setRegisterOpen(true)}
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
        onSuccess={() => navigate("/")}
      />
    </div>
  );
}

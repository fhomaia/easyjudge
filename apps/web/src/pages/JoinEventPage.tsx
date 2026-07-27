import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { savePendingJoinCode } from "@/lib/pendingJoinCode";
import { eventsApi, ApiError } from "@/api/client";
import { useAuthStore } from "@/store/auth";

// Destino do QR/código de um evento (ver ShareEventDialog) — precisa
// funcionar tanto logado quanto deslogado, por isso não fica dentro de
// ProtectedRoute nem GuestRoute (ver App.tsx). Deslogado, só guarda o
// código e manda pro login/cadastro (ver pendingJoinCode.ts +
// LoginPage); logado, resgata na hora.
export function JoinEventPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

    if (!accessToken) {
      savePendingJoinCode(code);
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;
    eventsApi
      .joinByCode(code)
      .then((event) => {
        if (cancelled) return;
        navigate(`/events/${event.id}/live/results`, { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível entrar no evento.",
        );
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, accessToken]);

  if (error) {
    return (
      <div className="flex h-svh items-center justify-center bg-background p-4">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
          <AlertTriangle className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{error}</p>
          <Link to="/" className="text-sm text-primary hover:underline">
            Voltar para a Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
      Entrando no evento...
    </div>
  );
}

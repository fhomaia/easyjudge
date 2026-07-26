import { create } from "zustand";
import { persist } from "zustand/middleware";

interface JwtPayload {
  sub: string;
  role: string;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload)) as JwtPayload;
  } catch {
    return null;
  }
}

interface AuthState {
  accessToken: string | null;
  userId: string | null;
  role: string | null;
  // Token do dono da conta ORIGINAL enquanto ele está "vendo como"
  // outro usuário (ver AuthService.impersonate) — null quando não está
  // impersonando ninguém. `impersonatingLabel` é só o nome exibido na
  // faixa de aviso (ImpersonationBanner).
  impersonatorToken: string | null;
  impersonatingLabel: string | null;
  login: (accessToken: string) => void;
  logout: () => void;
  startImpersonation: (accessToken: string, label: string) => void;
  stopImpersonation: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      userId: null,
      role: null,
      impersonatorToken: null,
      impersonatingLabel: null,
      login: (accessToken) => {
        const payload = decodeJwt(accessToken);
        set({
          accessToken,
          userId: payload?.sub ?? null,
          role: payload?.role ?? null,
        });
      },
      logout: () =>
        set({
          accessToken: null,
          userId: null,
          role: null,
          impersonatorToken: null,
          impersonatingLabel: null,
        }),
      startImpersonation: (accessToken, label) => {
        const currentToken = get().accessToken;
        if (!currentToken) return;
        set({ impersonatorToken: currentToken, impersonatingLabel: label });
        get().login(accessToken);
      },
      stopImpersonation: () => {
        const originalToken = get().impersonatorToken;
        if (!originalToken) return;
        get().login(originalToken);
        set({ impersonatorToken: null, impersonatingLabel: null });
      },
    }),
    { name: "easyjudge-auth" },
  ),
);

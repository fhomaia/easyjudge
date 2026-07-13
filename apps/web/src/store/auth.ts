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
  login: (accessToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      userId: null,
      role: null,
      login: (accessToken) => {
        const payload = decodeJwt(accessToken);
        set({
          accessToken,
          userId: payload?.sub ?? null,
          role: payload?.role ?? null,
        });
      },
      logout: () => set({ accessToken: null, userId: null, role: null }),
    }),
    { name: "easyjudge-auth" },
  ),
);

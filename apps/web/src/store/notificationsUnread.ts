import { useEffect } from "react";
import { create } from "zustand";
import { notificationsApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";

// Não lidas de todos os eventos do usuário (selo nos cards da Home e no
// item "Eventos" do menu). Sem polling: busca quando a Home/menu monta, no
// máximo uma vez por minuto, e força depois de marcar como lidas.
const MIN_REFRESH_MS = 60_000;

interface NotificationsUnreadState {
  total: number;
  byEvent: Record<string, number>;
  fetchedFor: string | null;
  fetchedAt: number;
  refresh: (force?: boolean) => Promise<void>;
}

export const useNotificationsUnreadStore = create<NotificationsUnreadState>((set, get) => ({
  total: 0,
  byEvent: {},
  fetchedFor: null,
  fetchedAt: 0,
  refresh: async (force = false) => {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      set({ total: 0, byEvent: {}, fetchedFor: null });
      return;
    }
    const { fetchedFor, fetchedAt } = get();
    if (!force && fetchedFor === token && Date.now() - fetchedAt < MIN_REFRESH_MS) return;
    set({ fetchedFor: token, fetchedAt: Date.now() });
    try {
      const res = await notificationsApi.unread();
      if (useAuthStore.getState().accessToken === token) set(res);
    } catch {
      // Selo é só um aviso: falha mantém o valor anterior.
    }
  },
}));

export function useNotificationsUnread(force = false) {
  const token = useAuthStore((s) => s.accessToken);
  const refresh = useNotificationsUnreadStore((s) => s.refresh);
  useEffect(() => {
    void refresh(force);
  }, [token, refresh, force]);
  const total = useNotificationsUnreadStore((s) => s.total);
  const byEvent = useNotificationsUnreadStore((s) => s.byEvent);
  return { total, byEvent };
}

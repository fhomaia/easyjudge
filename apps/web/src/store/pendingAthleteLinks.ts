import { useEffect } from "react";
import { create } from "zustand";
import { athletesApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";

// Quantos vínculos de atleta esperam a confirmação do programa logado
// (selo do item "Gerenciar atletas" e ponto no botão do menu do celular).
// Sem polling, pra economizar transferência do banco: busca quando um menu
// monta (no máximo uma vez por minuto por sessão) e a tela de atletas força
// a atualização depois de confirmar ou remover.
const MIN_REFRESH_MS = 60_000;

interface PendingAthleteLinksState {
  count: number;
  fetchedFor: string | null;
  fetchedAt: number;
  refresh: (force?: boolean) => Promise<void>;
}

export const usePendingAthleteLinksStore = create<PendingAthleteLinksState>((set, get) => ({
  count: 0,
  fetchedFor: null,
  fetchedAt: 0,
  refresh: async (force = false) => {
    const { accessToken: token, role } = useAuthStore.getState();
    if (!token || role !== "program") {
      if (get().count !== 0) set({ count: 0, fetchedFor: null });
      return;
    }
    const { fetchedFor, fetchedAt } = get();
    if (!force && fetchedFor === token && Date.now() - fetchedAt < MIN_REFRESH_MS) return;
    set({ fetchedFor: token, fetchedAt: Date.now() });
    try {
      const { count } = await athletesApi.pendingCount();
      if (useAuthStore.getState().accessToken === token) set({ count });
    } catch {
      // Selo é só um aviso: falha mantém o valor anterior.
    }
  },
}));

export function usePendingAthleteLinksCount(): number {
  const token = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const refresh = usePendingAthleteLinksStore((s) => s.refresh);
  const count = usePendingAthleteLinksStore((s) => s.count);
  useEffect(() => {
    void refresh();
  }, [token, role, refresh]);
  return role === "program" ? count : 0;
}

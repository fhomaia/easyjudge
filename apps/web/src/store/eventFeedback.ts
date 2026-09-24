import { create } from "zustand";
import type { Event } from "@/api/client";

// Avaliação do evento aberta de qualquer lugar (menu lateral, ícone de
// coração no cabeçalho mobile, menu ☰) — um popup só, montado no App
// (ver EventFeedbackHost).
interface EventFeedbackState {
  target: Event | null;
  open: (event: Event) => void;
  close: () => void;
}

export const useEventFeedbackStore = create<EventFeedbackState>((set) => ({
  target: null,
  open: (event) => set({ target: event }),
  close: () => set({ target: null }),
}));

// Quem pode avaliar: evento visível (publicado em diante) e quem não
// organiza (admin/assessor não avaliam o próprio evento, regra do
// backend).
export function canRateEvent(event: Event | null | undefined): event is Event {
  return (
    !!event &&
    (event.status === "published" || event.status === "started" || event.status === "completed") &&
    !event.currentUserRoles.some((r) => r === "admin" || r === "assessor")
  );
}

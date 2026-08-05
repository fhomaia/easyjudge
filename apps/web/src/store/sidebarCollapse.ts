import { create } from "zustand";
import { persist } from "zustand/middleware";

// Preferência de colapsar a sidebar de desktop (AppSidebar) — cada
// página monta sua própria instância de AppSidebar (não é um layout
// persistente via <Outlet>), então um useState local resetaria a cada
// navegação. Persistido em localStorage pelo mesmo motivo do
// useAuthStore (zustand/persist).
interface SidebarCollapseState {
  collapsed: boolean;
  toggle: () => void;
}

export const useSidebarCollapseStore = create<SidebarCollapseState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    { name: "easyjudge-sidebar-collapsed" },
  ),
);

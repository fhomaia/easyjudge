import { Calculator, CalendarDays, LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/roleLabels";
import type { UserProfile } from "@/api/client";

interface AppSidebarProps {
  profile: UserProfile | null;
  onLogout: () => void;
}

const NAV_ITEMS: { href: string; label: string; icon: typeof CalendarDays }[] = [
  { href: "/", label: "Eventos", icon: CalendarDays },
  { href: "/scoring-templates", label: "Sistema de pontuação", icon: Calculator },
];

function getUserInitials(profile: UserProfile): string {
  return `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();
}

function isNavItemActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppSidebar({ profile, onLogout }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="flex h-svh w-72 shrink-0 flex-col bg-brand-navy text-white">
      <div className="flex items-center gap-3 border-b border-white/10 p-6">
        <img src="/favicon.png" alt="" className="size-9 shrink-0 rounded-lg" />
        <p className="font-heading text-lg font-bold tracking-tight">
          easy<span className="text-brand-yellow-bright">Judge</span>
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <button
            key={href}
            type="button"
            onClick={() => navigate(href)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
              isNavItemActive(location.pathname, href)
                ? "bg-white/10 text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-white/10 p-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-sm font-semibold text-brand-navy">
            {profile ? getUserInitials(profile) : "…"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {profile ? `${profile.firstName} ${profile.lastName}` : "Carregando..."}
            </p>
            <p className="truncate text-xs text-white/50">
              {profile ? ROLE_LABELS[profile.role] : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Sair"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );
}

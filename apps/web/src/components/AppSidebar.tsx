import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { BrandMark, MobileNavSheet, NAV_ITEMS, type EventNavItem } from "@/components/MobileNavSheet";
import type { UserProfile } from "@/api/client";

interface AppSidebarProps {
  profile: UserProfile | null;
  onLogout: () => void;
  // Só passado por quem já está no contexto de um evento (hoje só a
  // versão desktop de `EventLiveDashboardPage`) — mesma seção "NESTE
  // EVENTO" do drawer mobile, mas na sidebar fixa de desktop.
  eventNavItems?: EventNavItem[];
}

function getUserInitials(profile: UserProfile): string {
  return `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();
}

function isNavItemActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLinks({
  onNavigate,
  eventNavItems,
}: {
  onNavigate: (href: string) => void;
  eventNavItems?: EventNavItem[];
}) {
  const location = useLocation();
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
      {eventNavItems && eventNavItems.length > 0 && (
        <>
          <p className="px-3 pt-1 pb-1.5 text-xs font-semibold tracking-wide text-white/40">
            NESTE EVENTO
          </p>
          {eventNavItems.map(({ key, label, icon: Icon, current, badge, onClick }) => (
            <button
              key={key}
              type="button"
              disabled={!onClick}
              onClick={onClick}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                current
                  ? "bg-white/10 text-white"
                  : onClick
                    ? "text-white/60 hover:bg-white/5 hover:text-white"
                    : "text-white/40",
              )}
            >
              <span className="relative flex">
                <Icon className="size-4" />
                {badge ? (
                  <span className="absolute -top-1.5 -right-1.5 flex size-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white">
                    {badge}
                  </span>
                ) : null}
              </span>
              {label}
            </button>
          ))}
          <div className="my-2 border-t border-white/10" />
        </>
      )}

      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <button
          key={href}
          type="button"
          onClick={() => onNavigate(href)}
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
  );
}

function ProfileFooter({
  profile,
  onLogout,
}: {
  profile: UserProfile | null;
  onLogout: () => void;
}) {
  return (
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
  );
}

export function AppSidebar({ profile, onLogout, eventNavItems }: AppSidebarProps) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile: barra fixa no topo com o hambúrguer. É `fixed` (fora do
          fluxo flex do layout de cada página) de propósito, pra funcionar
          em qualquer página que use AppSidebar sem exigir mudar o wrapper
          delas — a página só precisa reservar espaço no topo do <main>
          (ver `pt-14 sm:pt-0` na HomePage). */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-brand-navy px-4 text-white sm:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Menu className="size-5" />
        </button>
        <BrandMark compact />
      </div>

      <MobileNavSheet
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        profile={profile}
        onLogout={onLogout}
        onNavigate={navigate}
        eventNavItems={eventNavItems}
      />

      {/* Desktop: sidebar fixa como antes. */}
      <aside className="hidden h-svh w-72 shrink-0 flex-col bg-brand-navy text-white sm:flex">
        <div className="flex items-center gap-3 border-b border-white/10 p-6">
          <BrandMark />
        </div>

        <NavLinks onNavigate={navigate} eventNavItems={eventNavItems} />
        <ProfileFooter profile={profile} onLogout={onLogout} />
      </aside>
    </>
  );
}

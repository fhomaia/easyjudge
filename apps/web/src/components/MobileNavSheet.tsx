import { Calculator, CalendarDays, LogOut, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { UserProfile } from "@/api/client";

// `mobile: false` tira o item do menu hambúrguer sem afetar a sidebar de
// desktop — hoje só "Sistemas de pontuação", a pedido do usuário.
export const NAV_ITEMS: { href: string; label: string; icon: typeof CalendarDays; mobile?: boolean }[] = [
  { href: "/", label: "Eventos", icon: CalendarDays },
  { href: "/scoring-templates", label: "Sistemas de pontuação", icon: Calculator, mobile: false },
];

function getUserInitials(profile: UserProfile): string {
  return `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();
}

function isNavItemActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/favicon.png"
        alt=""
        className={cn("shrink-0 rounded-lg", compact ? "size-7 rounded-md" : "size-9")}
      />
      <p
        className={cn(
          "font-heading font-bold tracking-tight",
          compact ? "text-base" : "text-lg",
        )}
      >
        easy<span className="text-brand-yellow-bright">Judge</span>
      </p>
    </div>
  );
}

export interface EventNavItem {
  key: string;
  label: string;
  icon: typeof CalendarDays;
  current?: boolean;
  badge?: number;
  onClick?: () => void;
}

interface MobileNavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile | null;
  onLogout: () => void;
  onNavigate: (href: string) => void;
  // Só passado por quem já está no contexto de um evento (hoje só
  // `EventLiveDashboardPage`) — espelha as mesmas abas do menu inferior
  // mobile daquela tela. O `AppSidebar` (Home/setup) não passa isso, então
  // essa seção só aparece dentro da rota /live.
  eventNavItems?: EventNavItem[];
}

// Drawer de navegação mobile — mesmo visual da sidebar de desktop
// (`AppSidebar`), reaproveitado por qualquer página com hambúrguer
// próprio (ex. `EventLiveDashboardPage`), não só pelo `AppSidebar`.
export function MobileNavSheet({
  open,
  onOpenChange,
  profile,
  onLogout,
  onNavigate,
  eventNavItems,
}: MobileNavSheetProps) {
  const location = useLocation();

  function goTo(href: string) {
    onNavigate(href);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-72 gap-0 border-none bg-brand-navy p-0 text-white sm:hidden"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-6">
          <BrandMark />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar menu"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

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
                  onClick={() => {
                    onClick?.();
                    onOpenChange(false);
                  }}
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

          {NAV_ITEMS.filter((item) => item.mobile !== false).map(({ href, label, icon: Icon }) => (
            <button
              key={href}
              type="button"
              onClick={() => goTo(href)}
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
      </SheetContent>
    </Sheet>
  );
}

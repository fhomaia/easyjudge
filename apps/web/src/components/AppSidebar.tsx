import { CalendarDays, LogOut, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UserProfile } from "@/api/client";

export type SidebarSection = "events";

interface AppSidebarProps {
  profile: UserProfile | null;
  activeSection: SidebarSection;
  onSelectSection: (section: SidebarSection) => void;
  onLogout: () => void;
}

const NAV_ITEMS: { key: SidebarSection; label: string; icon: typeof CalendarDays }[] = [
  { key: "events", label: "Eventos", icon: CalendarDays },
];

export function AppSidebar({ profile, activeSection, onSelectSection, onLogout }: AppSidebarProps) {
  return (
    <aside className="flex h-svh w-72 shrink-0 flex-col border-r border-border/60 bg-card">
      <div className="flex items-center gap-3 border-b border-border/60 p-6">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UserRound className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {profile ? `${profile.firstName} ${profile.lastName}` : "Carregando..."}
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelectSection(key)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
              activeSection === key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 p-3">
        <Button variant="ghost" className="justify-start gap-2.5" onClick={onLogout}>
          <LogOut className="size-4" />
          Sair
        </Button>
        <img src="/favicon.png" alt="easyJudge" className="size-6 shrink-0 opacity-80" />
      </div>
    </aside>
  );
}

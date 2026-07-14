import { Archive, CheckCircle2, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Category } from "@/api/client";

interface StatCardConfig {
  key: string;
  label: string;
  subtitle: string;
  icon: typeof ListChecks;
  iconClassName: string;
  value: number;
}

export function CategoryStatCards({ categories }: { categories: Category[] }) {
  const stats: StatCardConfig[] = [
    {
      key: "total",
      label: "Total de categorias",
      subtitle: "Todas as categorias",
      icon: ListChecks,
      iconClassName: "bg-primary/10 text-primary",
      value: categories.length,
    },
    {
      key: "active",
      label: "Ativas",
      subtitle: "Categorias ativas",
      icon: CheckCircle2,
      iconClassName: "bg-emerald-500/10 text-emerald-600",
      value: categories.filter((c) => c.status === "active").length,
    },
    {
      key: "inactive",
      label: "Inativas",
      subtitle: "Categorias inativas",
      icon: Archive,
      iconClassName: "bg-slate-500/10 text-slate-600",
      value: categories.filter((c) => c.status === "inactive").length,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map(({ key, label, subtitle, icon: Icon, iconClassName, value }) => (
        <Card key={key} className="flex-row items-center gap-4 p-5">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full",
              iconClassName,
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

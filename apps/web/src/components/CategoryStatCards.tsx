import { Archive, CheckCircle2, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Category } from "@/api/client";

interface StatCardConfig {
  key: string;
  label: string;
  // Rótulo do celular (cartão estreito, sem ícone nem subtítulo).
  shortLabel: string;
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
      shortLabel: "Total",
      subtitle: "Todas as categorias",
      icon: ListChecks,
      iconClassName: "bg-primary/10 text-primary",
      value: categories.length,
    },
    {
      key: "active",
      label: "Ativas",
      shortLabel: "Ativas",
      subtitle: "Categorias ativas",
      icon: CheckCircle2,
      iconClassName: "bg-emerald-500/10 text-emerald-600",
      value: categories.filter((c) => c.status === "active").length,
    },
    {
      key: "inactive",
      label: "Inativas",
      shortLabel: "Inativas",
      subtitle: "Categorias inativas",
      icon: Archive,
      iconClassName: "bg-slate-500/10 text-slate-600",
      value: categories.filter((c) => c.status === "inactive").length,
    },
  ];

  return (
    // Celular: os três lado a lado, compactos (só número e rótulo curto);
    // antes cada um ocupava uma linha inteira e empurrava a lista pra baixo.
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {stats.map(({ key, label, shortLabel, subtitle, icon: Icon, iconClassName, value }) => (
        <Card key={key} className="flex-row items-center gap-4 p-3 sm:p-5">
          <div
            className={cn(
              "hidden size-11 shrink-0 items-center justify-center rounded-full sm:flex",
              iconClassName,
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-semibold text-foreground sm:text-2xl">{value}</p>
            <p className="text-xs font-medium text-foreground sm:hidden">{shortLabel}</p>
            <p className="hidden text-sm font-medium text-foreground sm:block">{label}</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

import type { Category } from "@/api/client";

// Etiquetas com o nome de cada categoria (equipe numa categoria). Usado na
// aba Equipes do programa e nos popups da lista de programas.
export function CategoryTags({
  categories,
  emptyLabel = "Nenhuma categoria",
}: {
  categories: Pick<Category, "id" | "name">[];
  emptyLabel?: string;
}) {
  if (categories.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {[...categories]
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .map((category) => (
          <span
            key={category.id}
            title={category.name}
            className="max-w-full truncate rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {category.name}
          </span>
        ))}
    </div>
  );
}

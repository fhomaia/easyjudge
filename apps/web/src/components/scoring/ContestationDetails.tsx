// Descrição e imagens que a equipe enviou ao contestar (2026-09-28).
// Usado na súmula do jurado e no detalhe (admin/programa/atleta). Nada
// renderiza quando a contestação veio sem descrição nem imagem.
export function ContestationDetails({
  description,
  attachments,
}: {
  description: string | null;
  attachments: string[];
}) {
  if (!description && attachments.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {description && (
        <p className="text-sm font-normal whitespace-pre-line break-words text-foreground">{description}</p>
      )}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((url, i) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block size-16 overflow-hidden rounded-lg border border-border bg-muted hover:opacity-90"
              title={`Abrir imagem ${i + 1}`}
            >
              <img src={url} alt={`Imagem ${i + 1} da contestação`} className="size-full object-cover" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

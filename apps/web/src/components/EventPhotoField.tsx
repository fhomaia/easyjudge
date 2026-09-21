import { useRef, type ChangeEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EventThumbnail } from "@/components/EventThumbnail";

const ACCEPTED_LOGO_TYPES = "image/png,image/jpeg,image/webp,image/svg+xml";
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

interface EventPhotoFieldProps {
  name: string;
  // Foto já salva no evento (edição). Aparece enquanto não há foto nova
  // escolhida; não dá pra remover (o backend só troca, não apaga).
  currentLogoUrl?: string | null;
  // Pré-visualização da foto NOVA escolhida (data: URL) — controlada
  // pelo pai, junto com o `File` que ele mesmo guarda pra enviar.
  preview: string | null;
  onSelect: (file: File, preview: string) => void;
  onClear: () => void;
  onError: (message: string | null) => void;
  disabled?: boolean;
}

export function EventPhotoField({
  name,
  currentLogoUrl = null,
  preview,
  onSelect,
  onClear,
  onError,
  disabled,
}: EventPhotoFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reseta já aqui (não só no caminho de erro abaixo) — sem isso, o
    // navegador não dispara `change` de novo se o usuário reabrir o
    // seletor e escolher EXATAMENTE o mesmo arquivo (mesmo path), o que
    // pareceria "preciso escolher a foto duas vezes" quando na
    // verdade a segunda escolha nem chegava a chamar este handler.
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      onError("A foto deve ter no máximo 5MB.");
      return;
    }
    onError(null);
    // data: URL, não `URL.createObjectURL` — o Safari/iOS tem um bug
    // conhecido onde a blob: URL às vezes não pinta no <img> logo após
    // selecionar o arquivo (fica quebrada até algo forçar um reflow,
    // ex. a navegação pra listagem depois de criar o evento, que já usa
    // a URL definitiva do servidor). data: URL não depende desse
    // registro interno do navegador, então não sofre esse problema.
    const reader = new FileReader();
    reader.onload = () => onSelect(file, reader.result as string);
    reader.readAsDataURL(file);
  }

  const hasPhoto = preview !== null || currentLogoUrl !== null;

  return (
    <div className="grid gap-2">
      <Label>
        Foto do evento{" "}
        <span className="text-sm font-normal text-muted-foreground">(opcional)</span>
      </Label>
      <div className="flex items-center gap-3">
        {preview ? (
          <div className="relative">
            <img
              // key força o React a trocar o nó da imagem em vez de só
              // atualizar `src` num nó já existente — nó novo sempre
              // pinta, evita qualquer chance de ficar "preso" num paint
              // antigo enquanto o popup ainda está no meio da animação
              // de entrada.
              key={preview}
              src={preview}
              alt=""
              className="size-16 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={() => {
                onClear();
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              disabled={disabled}
              aria-label="Remover foto"
              className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : (
          <EventThumbnail
            name={name || "Evento"}
            logoUrl={currentLogoUrl}
            className="size-16 text-base"
          />
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus data-icon="inline-start" />
          {hasPhoto ? "Trocar foto" : "Adicionar foto"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_LOGO_TYPES}
          className="hidden"
          onChange={handleChange}
        />
      </div>
    </div>
  );
}

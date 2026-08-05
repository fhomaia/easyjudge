import { useRef, useState } from "react";
import { Check, Copy, Download, QrCode, Share2 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Event } from "@/api/client";

interface ShareEventDialogProps {
  event: Event | null;
  onOpenChange: (open: boolean) => void;
}

// Só cosmético — o código é armazenado/comparado sem o traço (ver
// EventsService.joinByCode, que já normaliza qualquer coisa não
// alfanumérica na entrada).
function formatCodeForDisplay(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

// Acionado a partir de PublishEventCard (Setup) e EventActionsMenu
// (Home) — mesmo componente, cada um dono do próprio estado de
// aberto/fechado (ninguém mais precisa reagir a esse dialog).
export function ShareEventDialog({ event, onOpenChange }: ShareEventDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const joinUrl = event?.eventCode
    ? `${window.location.origin}/join/${event.eventCode}`
    : null;

  function handleCopy() {
    if (!event?.eventCode) return;
    navigator.clipboard
      .writeText(event.eventCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // Permissão de clipboard negada/indisponível — sem feedback de
        // "copiado", mas o código continua visível na tela pra copiar
        // manualmente.
      });
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas || !event?.eventCode) return;
    const link = document.createElement("a");
    link.download = `evento-${event.eventCode}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // Web Share API — abre a folha de compartilhamento nativa do
  // sistema (WhatsApp, email, Instagram, etc., o que estiver
  // instalado), em vez de reimplementar botão por app. Só existe em
  // navegadores mobile (majoritariamente) — sem `navigator.share`,
  // esse botão nem aparece, sobra só copiar/baixar QR de sempre.
  async function handleShare() {
    if (!joinUrl || !event) return;
    try {
      await navigator.share({
        title: event.name,
        text: `🎉 Acompanhe o "${event.name}" ao vivo! Resultado em tempo real, na Cheer Cup! 🏆`,
        url: joinUrl,
      });
    } catch (err) {
      // AbortError = usuário fechou a folha de compartilhamento sem
      // escolher nada — não é um erro de verdade, não precisa de feedback.
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) setCopied(false);
    onOpenChange(next);
  }

  return (
    <Dialog open={event !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Compartilhar evento</DialogTitle>
          <DialogDescription>Escaneie o QR code para acessar {event?.name}</DialogDescription>
        </div>

        {joinUrl && event?.eventCode ? (
          <div className="grid gap-5">
            <div className="flex justify-center rounded-2xl border border-border bg-card p-6">
              <QRCodeCanvas ref={canvasRef} value={joinUrl} size={200} level="M" />
            </div>

            <div className="grid gap-2 text-center">
              <p className="font-mono text-2xl font-semibold tracking-wider text-foreground">
                {formatCodeForDisplay(event.eventCode)}
              </p>
            </div>

            {typeof navigator.share === "function" && (
              <Button type="button" onClick={() => void handleShare()} className="w-full">
                <Share2 data-icon="inline-start" />
                Compartilhar
              </Button>
            )}

            {/* 1 coluna no mobile — 2 colunas (era sempre `grid-cols-2`)
                deixava pouco menos de 130px por botão num celular
                comum, e o texto do botão nunca quebra linha
                (`whitespace-nowrap`, ver ui/button.tsx) — "Copiar
                código" estourava a borda do próprio botão em vez de
                truncar ou quebrar. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={handleCopy}>
                {copied ? (
                  <Check data-icon="inline-start" />
                ) : (
                  <Copy data-icon="inline-start" />
                )}
                {copied ? "Copiado!" : "Copiar código"}
              </Button>
              <Button type="button" variant="outline" onClick={handleDownload}>
                <Download data-icon="inline-start" />
                Baixar QR
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <QrCode className="size-8" />
            Este evento foi publicado antes do compartilhamento por código
            existir — republique pra gerar um.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

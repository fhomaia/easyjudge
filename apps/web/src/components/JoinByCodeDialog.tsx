import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormError } from "@/components/FormError";
import { QrCodeScanner } from "@/components/QrCodeScanner";
import { eventsApi, ApiError, type Event } from "@/api/client";

interface JoinByCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoined: (event: Event) => void;
}

type JoinMode = "type" | "scan";

// O QR gerado por ShareEventDialog codifica a URL completa
// (`${origin}/join/${eventCode}`), não só o código — mas também aceita
// o valor bruto (se a câmera capturar um QR gerado de outra forma, ex.
// impresso à mão só com o código), sem exigir que seja sempre uma URL.
function extractEventCode(scanned: string): string {
  try {
    const url = new URL(scanned);
    const match = url.pathname.match(/\/join\/([^/]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    // não é uma URL — assume que o valor escaneado já é o código
  }
  return scanned.trim();
}

// "Tenho um código" na Home — mesmo resultado de escanear o QR com a
// câmera do próprio celular (ver ShareEventDialog/JoinEventPage), com
// duas formas de chegar lá: digitar à mão ou ativar a câmera aqui
// dentro (aba "Escanear QR", QrCodeScanner) pra quem já está logado e
// não quer sair do app pra abrir a câmera do sistema.
export function JoinByCodeDialog({ open, onOpenChange, onJoined }: JoinByCodeDialogProps) {
  const [mode, setMode] = useState<JoinMode>("type");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Muda a cada tentativa malsucedida vinda do scanner — usado como
  // `key` do QrCodeScanner pra forçar remount (e a câmera voltar a
  // escanear; ela já parou sozinha ao ler o código da vez anterior).
  const [scanAttempt, setScanAttempt] = useState(0);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setMode("type");
      setCode("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function joinWithCode(rawCode: string) {
    setError(null);
    setLoading(true);
    try {
      const event = await eventsApi.joinByCode(rawCode);
      onJoined(event);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
      setScanAttempt((n) => n + 1);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await joinWithCode(code);
  }

  function handleScan(rawValue: string) {
    const extracted = extractEventCode(rawValue);
    setCode(extracted);
    void joinWithCode(extracted);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Tenho um código</DialogTitle>
          <DialogDescription>
            Digite o código do evento ou escaneie o QR pra adicioná-lo à sua lista como
            espectador.
          </DialogDescription>
        </div>

        <FormError message={error} />

        <Tabs value={mode} onValueChange={(v) => setMode(v as JoinMode)}>
          <TabsList className="w-full">
            <TabsTrigger value="type" className="flex-1">
              Digitar código
            </TabsTrigger>
            <TabsTrigger value="scan" className="flex-1">
              Escanear QR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="type" className="mt-5">
            <form onSubmit={handleSubmit} className="grid gap-5">
              <Input
                autoFocus
                placeholder="XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-center font-mono text-lg tracking-wider uppercase"
              />
              <Button type="submit" disabled={loading || !code.trim()} className="w-full">
                {loading ? "Entrando..." : "Entrar no evento"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="scan" className="mt-5">
            <QrCodeScanner
              key={scanAttempt}
              active={open && mode === "scan"}
              onScan={handleScan}
            />
            {loading && (
              <p className="mt-3 text-center text-sm text-muted-foreground">Entrando...</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

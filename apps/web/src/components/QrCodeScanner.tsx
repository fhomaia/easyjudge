import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { VideoOff } from "lucide-react";

interface QrCodeScannerProps {
  // Câmera só é pedida/ligada enquanto `active` — controlado pelo pai
  // (aba "Escanear QR" selecionada E dialog aberto). Nunca fica rodando
  // em segundo plano.
  active: boolean;
  onScan: (value: string) => void;
}

// Para acessando via HTTPS (getUserMedia exige contexto seguro,
// já garantido em produção — cheercup.com.br — e em localhost no dev).
export function QrCodeScanner({ active, onScan }: QrCodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);

  // Ref em vez de dependência direta do efeito abaixo — `onScan` chega
  // como closure nova a cada render do pai (`handleScan`), e recriar a
  // câmera/scanner nesses casos reiniciaria o stream sem necessidade.
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!active || !videoRef.current) return;

    setError(null);
    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        // Para no primeiro código lido — sem isso, o scanner continua
        // decodificando quadro a quadro e dispararia `onScan` repetido
        // enquanto a câmera continuar apontada pro mesmo QR (o pai
        // ainda está processando a tentativa anterior).
        scanner.stop();
        onScanRef.current(result.data);
      },
      {
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
      },
    );

    scanner.start().catch((err: unknown) => {
      const name = err instanceof Error ? err.name : "";
      setError(
        name === "NotAllowedError"
          ? "Permissão de câmera negada. Use a aba \"Digitar código\"."
          : "Não foi possível acessar a câmera. Use a aba \"Digitar código\".",
      );
    });

    return () => {
      scanner.stop();
      scanner.destroy();
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="grid gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-center text-sm text-destructive">
          <VideoOff className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

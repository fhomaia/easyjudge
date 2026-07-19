import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Silhueta de raio clássica (viewBox 160x100, preserveAspectRatio="xMidYMid slice"
// evita esticar/distorcer o traço e as fotos em telas com proporções diferentes).
const BOLT_LINE = "100,0 62,40 94,40 50,100";
const LEFT_REGION = "0,0 100,0 62,40 94,40 50,100 0,100";
const RIGHT_REGION = "160,0 100,0 62,40 94,40 50,100 160,100";

type Phase = "strike" | "flash" | "done";

interface BrandBackdropProps {
  // Por padrão fica atrás de tudo (-z-10, uso normal em Login/Home) —
  // sobrescrito quando reaproveitado como overlay POR CIMA da página
  // (ver PublishCelebrationOverlay), que precisa de um z-index positivo.
  className?: string;
  // "split" (default, Login/Home): fase final revela a tela dividida
  // em azul/amarelo com as fotos e o contorno branco do raio, e fica
  // assim. "plain" (PublishCelebrationOverlay): a fase final não
  // renderiza nada — só o raio riscando + o flash, depois o fundo
  // volta a ficar transparente, revelando o que estiver atrás (o
  // overlay coloca sua própria imagem de fundo por trás).
  variant?: "split" | "plain";
  // Disparado quando a animação chega na fase final (raio some, no
  // variant "split" a tela dividida é revelada) — usado pelo overlay
  // de publicação pra só então revelar a mensagem "Prontos para o
  // show!".
  onDone?: () => void;
}

export function BrandBackdrop({ className, variant = "split", onDone }: BrandBackdropProps) {
  const [phase, setPhase] = useState<Phase>("strike");

  useEffect(() => {
    const toFlash = setTimeout(() => setPhase("flash"), 650);
    const toDone = setTimeout(() => {
      setPhase("done");
      onDone?.();
    }, 900);
    return () => {
      clearTimeout(toFlash);
      clearTimeout(toDone);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 overflow-hidden transition-colors duration-300",
        className ?? "-z-10",
      )}
      style={{
        // No variant "plain" o fundo próprio nunca fica opaco — é pra
        // deixar o que estiver atrás (a imagem do overlay de
        // publicação) visível desde o primeiro frame, com o raio
        // riscando por cima dela, em vez de esconder tudo atrás de um
        // navy sólido até a animação acabar (pedido do usuário).
        backgroundColor:
          variant === "split" && phase === "strike" ? "var(--brand-navy)" : undefined,
      }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 160 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <clipPath id="bolt-clip-left">
            <polygon points={LEFT_REGION} />
          </clipPath>
          <clipPath id="bolt-clip-right">
            <polygon points={RIGHT_REGION} />
          </clipPath>
        </defs>

        {variant === "split" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "strike" ? 0 : 1 }}
            transition={{ duration: 0.2 }}
          >
            <g clipPath="url(#bolt-clip-left)">
              {/* bg-left.webp já vem pré-recortada (via PIL, a partir do
                  arquivo original em alta resolução) com a atleta
                  posicionada à esquerda do quadro — não precisa de zoom
                  nem deslocamento aqui. width=100 é exatamente a largura
                  da região visível (cobertura mínima, sem upscale extra
                  que perderia nitidez); a altura sobra (153 > 100) e
                  estoura pro rodapé, então a foto aparece cortada embaixo
                  e sobra uma faixa fina da cor no topo em vez de vazio. */}
              <rect x={0} y={0} width={160} height={100} fill="var(--brand-blue)" />
              <image
                href="/bg-left.webp"
                x={0}
                y={-5}
                width={100}
                height={153}
                preserveAspectRatio="xMidYMid slice"
              />
              <rect
                x={0}
                y={0}
                width={160}
                height={100}
                fill="var(--brand-blue)"
                opacity={0.55}
              />
            </g>
            <g clipPath="url(#bolt-clip-right)">
              <rect x={0} y={0} width={160} height={100} fill="var(--brand-yellow)" />
              <image
                href="/bg-right.webp"
                x={44}
                y={9}
                width={122}
                height={81}
                preserveAspectRatio="xMidYMid slice"
              />
              <rect
                x={0}
                y={0}
                width={160}
                height={100}
                fill="var(--brand-yellow)"
                opacity={0.55}
              />
            </g>
          </motion.g>
        )}

        {phase === "strike" && (
          <motion.polyline
            points={BOLT_LINE}
            fill="none"
            stroke="var(--brand-yellow-bright)"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter:
                "drop-shadow(0 0 3px var(--brand-yellow-bright)) drop-shadow(0 0 10px var(--brand-blue))",
            }}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.65, ease: "easeInOut" }}
          />
        )}

        {/* No variant "plain" o contorno branco só aparece durante o
            flash — na fase "done" o raio já deve ter sumido da tela
            (pedido do usuário), diferente do variant "split" onde ele
            fica marcando a divisão azul/amarelo permanentemente. */}
        {(phase === "flash" || (phase === "done" && variant === "split")) && (
          <motion.polyline
            points={BOLT_LINE}
            fill="none"
            stroke="white"
            strokeWidth={0.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </svg>

      <AnimatePresence>
        {phase === "flash" && (
          <motion.div
            className="absolute inset-0 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, times: [0, 0.4, 1] }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

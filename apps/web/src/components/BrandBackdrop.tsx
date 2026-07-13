import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Silhueta de raio clássica (viewBox 160x100, preserveAspectRatio="xMidYMid slice"
// evita esticar/distorcer o traço e as fotos em telas com proporções diferentes).
const BOLT_LINE = "100,0 62,40 94,40 50,100";
const LEFT_REGION = "0,0 100,0 62,40 94,40 50,100 0,100";
const RIGHT_REGION = "160,0 100,0 62,40 94,40 50,100 160,100";

type Phase = "strike" | "flash" | "done";

export function BrandBackdrop() {
  const [phase, setPhase] = useState<Phase>("strike");

  useEffect(() => {
    const toFlash = setTimeout(() => setPhase("flash"), 650);
    const toDone = setTimeout(() => setPhase("done"), 900);
    return () => {
      clearTimeout(toFlash);
      clearTimeout(toDone);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: phase === "strike" ? "var(--brand-navy)" : undefined }}
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

        {phase !== "strike" && (
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

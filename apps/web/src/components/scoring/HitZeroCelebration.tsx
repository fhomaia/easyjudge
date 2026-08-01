import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Zap } from "lucide-react";
import { BrandBackdrop } from "@/components/BrandBackdrop";

// "Hit zero" — termo do cheer pra uma apresentação sem NENHUMA dedução
// de legalidade. Reaproveita o mesmo raio de EventCelebrationOverlay
// (variant="plain", overlay POR CIMA da página, não atrás), mas sem a
// foto de fundo fixa dela — aqui o "fundo" é a própria súmula que a
// equipe/atleta já está olhando, só escurecida por um scrim enquanto o
// texto aparece. Toca sempre que uma súmula com zero deduções é aberta
// (decisão do usuário: sem controle de "já vi antes"), então precisa
// ser rápida e se fechar sozinha — sem exigir clique. Um toque em
// qualquer lugar pula direto pro fim, pra quem já viu centenas de vezes.
//
// 1ª versão era só o raio + texto estático sobre um scrim navy — o
// usuário achou "formal demais" pra uma comemoração de verdade.
// Reforçado com confete (bursting a partir do centro, paleta da marca)
// + bounce mais forte no ícone/título + copy mais empolgada.
const HOLD_MS = 2200;
const FADE_MS = 400;
const CONFETTI_COLORS = [
  "var(--brand-yellow-bright)",
  "var(--brand-yellow)",
  "var(--brand-blue)",
  "#ffffff",
];
const CONFETTI_COUNT = 18;

interface ConfettiPiece {
  id: number;
  color: string;
  x: number;
  y: number;
  rotate: number;
  delay: number;
  size: number;
}

function buildConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const angle = (i / CONFETTI_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const distance = 110 + Math.random() * 140;
    return {
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 20,
      rotate: Math.random() * 360,
      delay: Math.random() * 0.25,
      size: 6 + Math.random() * 7,
    };
  });
}

export function HitZeroCelebration() {
  const [phase, setPhase] = useState<"waiting" | "showing" | "gone">("waiting");
  const confetti = useMemo(buildConfetti, []);

  useEffect(() => {
    if (phase !== "showing") return;
    const timeout = setTimeout(() => setPhase("gone"), HOLD_MS);
    return () => clearTimeout(timeout);
  }, [phase]);

  return (
    <AnimatePresence>
      {phase !== "gone" && (
        <motion.div
          className="fixed inset-0 z-50 overflow-hidden"
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_MS / 1000 }}
          onClick={() => setPhase("gone")}
        >
          {phase === "showing" && (
            <motion.div
              className="absolute inset-0 z-0 bg-brand-navy/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}
          <BrandBackdrop className="z-0" variant="plain" onDone={() => setPhase("showing")} />

          <AnimatePresence>
            {phase === "showing" && (
              <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
                {confetti.map((piece) => (
                  <motion.span
                    key={piece.id}
                    className="absolute top-1/2 left-1/2 rounded-sm"
                    style={{
                      width: piece.size,
                      height: piece.size * 0.4,
                      backgroundColor: piece.color,
                    }}
                    initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.4 }}
                    animate={{
                      x: piece.x,
                      y: [0, piece.y, piece.y + 70],
                      opacity: [0, 1, 1, 0],
                      rotate: piece.rotate,
                      scale: 1,
                    }}
                    transition={{
                      delay: piece.delay,
                      duration: 1.5,
                      ease: "easeOut",
                      times: [0, 0.35, 0.8, 1],
                    }}
                  />
                ))}

                <motion.div
                  className="flex flex-col items-center gap-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
                >
                  <motion.div
                    initial={{ scale: 0.3, opacity: 0, rotate: -25 }}
                    animate={{ scale: [0.3, 1.25, 1], opacity: 1, rotate: 0 }}
                    transition={{ delay: 0.2, duration: 0.7, type: "spring", bounce: 0.65 }}
                  >
                    <Zap className="mx-auto size-16 fill-brand-yellow-bright text-brand-yellow-bright drop-shadow-lg" />
                  </motion.div>

                  <motion.h1
                    className="text-5xl font-black tracking-tight text-white drop-shadow-lg sm:text-7xl"
                    initial={{ scale: 0.7 }}
                    animate={{ scale: [0.7, 1.15, 1] }}
                    transition={{ delay: 0.25, duration: 0.6, ease: "easeOut" }}
                  >
                    HIT ZERO!
                  </motion.h1>
                  <p className="max-w-md text-lg font-semibold text-white/95">
                    Nenhuma dedução na apresentação
                    <br />
                    Mandou muito bem!
                  </p>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

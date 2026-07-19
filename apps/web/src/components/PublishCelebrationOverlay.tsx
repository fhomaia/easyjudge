import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandBackdrop } from "@/components/BrandBackdrop";

interface PublishCelebrationOverlayProps {
  open: boolean;
  onGoHome: () => void;
}

// Disparado ao publicar o evento (ver PublishEventCard) — reaproveita a
// mesma animação de raio da tela de login (BrandBackdrop), só que como
// um overlay POR CIMA da página atual (z-50, não -z-10) em vez de atrás
// dela — os elementos da página de setup ficam completamente
// encobertos (o próprio fundo opaco do raio já resolve isso, sem
// precisar de nenhum efeito de opacidade à parte). Depois que o raio
// termina (BrandBackdrop.onDone), revela "Prontos para o show!" + CTA
// pra Home, no mesmo estilo de reveal com delay já usado no logo da
// LoginPage.
//
// Fundo (2026-07-19, a pedido do usuário): variant="plain" no
// BrandBackdrop — o raio risca a tela e o flash estoura igual ao
// login, mas a fase final não revela o split azul/amarelo com as duas
// fotos; em vez disso o BrandBackdrop fica transparente do primeiro
// frame em diante (nesse variant ele nunca pinta um navy sólido por
// cima), revelando esta imagem única (`bg-publish-celebration.webp`)
// posicionada atrás dele no DOM (mesma z-index, a ordem no DOM decide
// quem fica por cima) — ela já aparece assim que a tela é aberta, o
// raio risca por cima dela em vez de escondê-la até a animação acabar.
// Uma camada `bg-brand-navy/55` fica entre a foto e o BrandBackdrop
// pra escurecer o fundo (a foto tem uma nuvem bem clara no centro,
// exatamente onde o texto cai) e garantir contraste pro texto branco.
export function PublishCelebrationOverlay({ open, onGoHome }: PublishCelebrationOverlayProps) {
  const [showMessage, setShowMessage] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/bg-publish-celebration.webp)" }}
      />
      <div className="absolute inset-0 z-0 bg-brand-navy/55" />
      <BrandBackdrop className="z-0" variant="plain" onDone={() => setShowMessage(true)} />

      <AnimatePresence>
        {showMessage && (
          <motion.div
            className="relative z-10 flex h-full flex-col items-center justify-center gap-6 p-4 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0, rotate: -15 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ delay: 0.35, duration: 0.7, type: "spring", bounce: 0.55 }}
            >
              <PartyPopper className="mx-auto size-16 text-white drop-shadow-lg" />
            </motion.div>

            <h1 className="text-4xl font-bold text-white drop-shadow-lg sm:text-6xl">
              Prontos para o show!
            </h1>
            <p className="max-w-md text-lg text-white/90">
              Seu evento foi publicado com sucesso.
            </p>

            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="mt-4">
              <Button size="lg" onClick={onGoHome}>
                Ir para a Home
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

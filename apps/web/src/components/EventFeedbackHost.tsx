import { useEffect, useState } from "react";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { feedbackApi, type MyEventFeedback } from "@/api/client";
import { useEventFeedbackStore } from "@/store/eventFeedback";

// Popup único da avaliação do evento (nota + comentário), aberto por
// useEventFeedbackStore.open(event). Separado da avaliação da
// plataforma (PlatformFeedbackDialog).
export function EventFeedbackHost() {
  const target = useEventFeedbackStore((s) => s.target);
  const close = useEventFeedbackStore((s) => s.close);
  const [mine, setMine] = useState<MyEventFeedback | null | undefined>(undefined);

  useEffect(() => {
    setMine(undefined);
    if (!target) return;
    feedbackApi
      .getMine(target.aliasId)
      .then(setMine)
      .catch(() => setMine(null));
  }, [target]);

  if (!target || mine === undefined) return null;

  return (
    <FeedbackDialog
      open
      onOpenChange={(open) => !open && close()}
      title="Avaliar o evento"
      description={`O que você achou de "${target.name}"? Sua avaliação é sobre o evento, e a organização vai ver o seu nome.`}
      thanksMessage="Obrigado! A organização vai receber a sua avaliação."
      initialRating={mine?.rating ?? 0}
      initialComment={mine?.comment ?? ""}
      // Não atualiza `mine` aqui: mudar os valores iniciais reiniciaria o
      // popup e esconderia o agradecimento. Ao reabrir, busca de novo.
      onSubmit={async (rating, comment) => {
        await feedbackApi.saveMine(target.aliasId, { rating, comment: comment || undefined });
      }}
    />
  );
}

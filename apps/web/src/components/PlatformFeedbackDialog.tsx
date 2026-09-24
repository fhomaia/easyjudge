import { useLocation } from "react-router-dom";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { feedbackApi } from "@/api/client";

// Avaliação da Cheer Cup (plataforma), aberta pelo menu. Separada da
// avaliação do evento (ver EventFeedbackHost).
export function PlatformFeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const location = useLocation();
  return (
    <FeedbackDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Avaliar a Cheer Cup"
      description="Como está sendo usar a plataforma? Sua avaliação é sobre a Cheer Cup, não sobre um evento específico."
      thanksMessage="Obrigado! Sua avaliação vai ajudar a melhorar a Cheer Cup."
      onSubmit={(rating, comment) =>
        feedbackApi.sendPlatform({ rating, comment: comment || undefined, page: location.pathname })
      }
    />
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormError";
import { formatMinutes } from "@/lib/scheduleTime";

interface ScheduleOverflowDialogProps {
  open: boolean;
  newEndMinutes: number | null;
  onExtend: () => Promise<void>;
  onCancel: () => Promise<void>;
}

// Aberto quando criar/agendar um item empurra o fim do dia pra depois
// do "Horário do dia" definido em ScheduleDaySettingsBar. Não usa
// ConfirmDialog (que trata "cancelar" como um simples fechar sem
// efeito colateral, pensado pra ações que ainda não aconteceram) —
// aqui o item já foi criado no backend antes desse popup aparecer (só
// depois de criar dá pra saber o horário final de verdade, que
// depende de reconciliação de aquecimento/apresentação do backend);
// "Cancelar ação" precisa desfazer de verdade (remover o item criado),
// não só fechar o popup. Por isso força uma escolha explícita — sem
// fechar por fora/Esc, já que deixar sem decidir deixaria o dia num
// estado que ultrapassa o horário configurado sem o usuário saber.
export function ScheduleOverflowDialog({
  open,
  newEndMinutes,
  onExtend,
  onCancel,
}: ScheduleOverflowDialogProps) {
  const [loading, setLoading] = useState<"extend" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExtend() {
    setError(null);
    setLoading("extend");
    try {
      await onExtend();
    } catch {
      setError("Não foi possível estender o horário do dia. Tente novamente.");
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel() {
    setError(null);
    setLoading("cancel");
    try {
      await onCancel();
    } catch {
      setError("Não foi possível desfazer esta ação. Tente novamente.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="gap-6 p-8 sm:max-w-md" showCloseButton={false}>
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">
            Isso ultrapassa o horário do dia
          </DialogTitle>
          <DialogDescription>
            {newEndMinutes != null &&
              `Esse item termina às ${formatMinutes(newEndMinutes)}, depois do horário de término definido para o dia. Você pode estender o horário do dia até lá, ou cancelar essa ação.`}
          </DialogDescription>
        </div>

        <FormError message={error} />

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleCancel} disabled={!!loading}>
            {loading === "cancel" ? "Cancelando..." : "Cancelar ação"}
          </Button>
          <Button onClick={handleExtend} disabled={!!loading}>
            {loading === "extend" ? "Estendendo..." : "Estender horário do dia"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

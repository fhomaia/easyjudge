import { Clock } from "lucide-react";
import { BlinkingDot } from "@/components/BlinkingDot";
import { EventStatusBadge } from "@/components/EventStatusBadge";
import { hasEventStaffRole } from "@/lib/eventMemberRoles";
import type { Event } from "@/api/client";

export function EventStatusIndicator({ event }: { event: Event }) {
  if (event.status === "started") {
    return (
      <span className="flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-600">
        <BlinkingDot colorClassName="bg-red-500" />
        Ao vivo
      </span>
    );
  }

  // Evento "criado" aparece na Home pra qualquer vínculo (2026-09-23),
  // mas quem não é admin/assessor/judge ainda não consegue abrir —
  // mostra "Em breve" em vez do badge real de status ("Criado" é
  // informação de gestão, não interessa a quem só participa).
  if (event.status === "created" && !hasEventStaffRole(event.currentUserRoles)) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
        <Clock className="size-3.5" />
        Em breve
      </span>
    );
  }

  return <EventStatusBadge status={event.status} />;
}

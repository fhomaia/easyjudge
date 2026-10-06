import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { EventThumbnail } from "@/components/EventThumbnail";
import { Button } from "@/components/ui/button";
import { formatDeadline } from "@/lib/registrationWindow";
import { athleteRegistrationApi, type AthleteRegistrationEvent } from "@/api/client";

// Home do atleta (2026-10-06): eventos em que um programa colocou a pessoa
// numa categoria. Completar dados e documentos é OPCIONAL pro atleta (o
// programa pode fazer tudo). "Inscreva-se aqui!" até o programa ou o
// atleta enviar; depois, "Minha inscrição". Some quando não há nenhum
// (e pra conta Programa a API devolve vazio).
export function AthleteRegistrationsStrip() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AthleteRegistrationEvent[]>([]);

  useEffect(() => {
    athleteRegistrationApi
      .listMine()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="grid gap-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Suas inscrições como atleta</h2>
        <p className="text-sm text-muted-foreground">
          Seu programa colocou você nestes eventos. Se quiser, complete os dados e documentos que o
          evento pede (o programa também pode fazer isso por você).
        </p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {items.map((event) => {
          const pending = event.entries.reduce((sum, e) => sum + e.pendingCount, 0);
          const contested = event.entries.reduce((sum, e) => sum + e.contestedCount, 0);
          const programs = event.entries.map((e) => e.programName).join(", ");
          // Programa ou o próprio atleta já enviou: "Minha inscrição".
          const submitted = event.entries.every(
            (e) => e.requirements.programSubmitted || !!e.requirements.athleteSubmittedAt,
          );
          return (
            <div
              key={event.eventId}
              className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <EventThumbnail
                  name={event.name}
                  logoUrl={event.logoUrl}
                  className="size-12 shrink-0 rounded-lg text-sm"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{event.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{programs}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {contested > 0 ? (
                      <span className="flex items-center gap-1 font-medium text-destructive">
                        <AlertCircle className="size-3.5" />
                        {contested === 1 ? "1 documento contestado" : `${contested} documentos contestados`}
                      </span>
                    ) : pending > 0 ? (
                      <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                        <AlertCircle className="size-3.5" />
                        {pending === 1 ? "Falta 1 item" : `Faltam ${pending} itens`}
                      </span>
                    ) : submitted ? (
                      <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5" />
                        Inscrição enviada
                      </span>
                    ) : null}
                    {event.open && event.registrationDeadline && (
                      <span className="text-muted-foreground">
                        Até {formatDeadline(event.registrationDeadline)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant={submitted ? "outline" : "default"}
                className="w-full sm:w-auto"
                onClick={() => navigate(`/events/${event.eventId}/my-registration`)}
              >
                {submitted ? "Minha inscrição" : "Inscreva-se aqui!"}
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

import { openDB, type IDBPDatabase } from "idb";
import { scoringApi, type ScoreEventInput } from "@/api/client";

// Camada de durabilidade da tela de lançar notas — "notas nunca podem
// ser perdidas" (ver CLAUDE.md, Requisitos não-negociáveis). Toda
// interação do jurado grava aqui PRIMEIRO (`enqueueEvent`, síncrono
// localmente) — só depois disso o evento tenta ser enviado ao
// servidor. Se a rede cair no meio, o evento continua no IndexedDB e
// uma recarga da página consegue recuperá-lo (ver `getPendingEvents`).
// O object store só guarda o que ainda NÃO foi confirmado pelo
// servidor — assim que `submitEvents` responde com sucesso, o evento
// sai da fila (ele já está seguro no Postgres, event-sourced).

const DB_NAME = "easyjudge-score-events";
const DB_VERSION = 1;
const STORE = "queue";

interface QueuedScoreEvent extends ScoreEventInput {
  // A quais desses vários eventos (competições) essa nota pertence —
  // permite filtrar a fila por evento sem precisar de vários bancos.
  competitionEventId: string;
  // Preenchido só quando o Head Judge está editando a folha de OUTRO
  // jurado (Painel Head Judge, Modo Supervisão) — ver
  // ScoringService.submitEventsAsHeadJudge no backend. `undefined` =
  // fluxo normal (o próprio dono está pontuando).
  onBehalfOfJudgeParticipationId?: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueEvent(
  competitionEventId: string,
  event: ScoreEventInput,
  onBehalfOfJudgeParticipationId?: string,
): Promise<void> {
  const db = await getDb();
  const row: QueuedScoreEvent = { ...event, competitionEventId, onBehalfOfJudgeParticipationId };
  await db.put(STORE, row);
}

export async function getPendingEvents(
  competitionEventId: string,
  scheduleEntryId?: string,
  onBehalfOfJudgeParticipationId?: string,
): Promise<ScoreEventInput[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE)) as QueuedScoreEvent[];
  return all
    .filter(
      (e) =>
        e.competitionEventId === competitionEventId &&
        (!scheduleEntryId || e.scheduleEntryId === scheduleEntryId) &&
        e.onBehalfOfJudgeParticipationId === onBehalfOfJudgeParticipationId,
    )
    .map(({ competitionEventId: _drop, onBehalfOfJudgeParticipationId: _drop2, ...rest }) => rest);
}

async function removeFromQueue(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const tx = db.transaction(STORE, "readwrite");
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}

// Tenta esvaziar a fila desse evento agora — usado tanto pelo loop
// periódico quanto por uma ação explícita (botão "Lançar notas", ou o
// evento `online` do navegador). Nunca lança: falha de rede só deixa o
// evento na fila pro próximo tick, não interrompe a tela.
//
// Agrupa os pendentes por "em nome de quem" (fluxo normal vs edição do
// Painel Head Judge — ver enqueueEvent) e, dentro de cada edição de
// Head Judge, por apresentação (o endpoint de edição é escopado a
// uma folha por vez). Cada grupo é enviado independentemente — a falha
// de um não impede os outros de sincronizar.
export async function flushQueue(competitionEventId: string): Promise<{ pendingAfter: number }> {
  const db = await getDb();
  const all = (await db.getAll(STORE)) as QueuedScoreEvent[];
  const pending = all.filter((e) => e.competitionEventId === competitionEventId);
  if (pending.length === 0) return { pendingAfter: 0 };

  const selfEvents: QueuedScoreEvent[] = [];
  const headJudgeGroups = new Map<string, QueuedScoreEvent[]>();
  for (const row of pending) {
    if (!row.onBehalfOfJudgeParticipationId) {
      selfEvents.push(row);
      continue;
    }
    const key = `${row.onBehalfOfJudgeParticipationId}:${row.scheduleEntryId}`;
    const list = headJudgeGroups.get(key) ?? [];
    list.push(row);
    headJudgeGroups.set(key, list);
  }

  const toRow = ({ competitionEventId: _drop, onBehalfOfJudgeParticipationId: _drop2, ...rest }: QueuedScoreEvent) =>
    rest as ScoreEventInput;

  const settled: string[] = [];
  await Promise.allSettled([
    ...(selfEvents.length > 0
      ? [
          scoringApi
            .submitEvents(competitionEventId, selfEvents.map(toRow))
            .then(() => settled.push(...selfEvents.map((e) => e.id))),
        ]
      : []),
    ...Array.from(headJudgeGroups.entries()).map(([key, group]) => {
      const [judgeParticipationId, scheduleEntryId] = key.split(":");
      return scoringApi.headJudge
        .submitEvents(competitionEventId, scheduleEntryId, judgeParticipationId, group.map(toRow))
        .then(() => settled.push(...group.map((e) => e.id)));
    }),
  ]);

  await removeFromQueue(settled);
  const remaining = (await db.getAll(STORE)) as QueuedScoreEvent[];
  const stillPending = remaining.filter((e) => e.competitionEventId === competitionEventId);
  return { pendingAfter: stillPending.length };
}

export async function getPendingCount(competitionEventId: string): Promise<number> {
  const pending = await getPendingEvents(competitionEventId);
  return pending.length;
}

// Roda em intervalo curto + no evento `online` do navegador. Devolve
// uma função de limpeza (chamar no unmount da tela).
export function startSyncLoop(
  competitionEventId: string,
  onFlush: (pendingCount: number) => void,
  intervalMs = 4000,
): () => void {
  let cancelled = false;

  async function tick() {
    if (cancelled) return;
    const { pendingAfter } = await flushQueue(competitionEventId);
    if (!cancelled) onFlush(pendingAfter);
  }

  const interval = setInterval(tick, intervalMs);
  window.addEventListener("online", tick);
  void tick();

  return () => {
    cancelled = true;
    clearInterval(interval);
    window.removeEventListener("online", tick);
  };
}

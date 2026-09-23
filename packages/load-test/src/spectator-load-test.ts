import path from "node:path";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { Client } from "pg";
import jwt from "jsonwebtoken";
import { io, type Socket } from "socket.io-client";

// Teste de carga descartável: simula N espectadores entrando no painel
// "evento ao vivo" ao mesmo tempo (conexão Socket.io na sala do evento
// + as leituras REST que a Home/Início/Cronograma/Resultados fazem ao
// abrir), depois dispara um broadcast real (POST /events/:id/start,
// que emite `event.status_changed`) e mede quanto tempo leva pra
// chegar em todo mundo. Cria e apaga TODO o próprio dado de teste
// (evento, membros, usuários) — nunca toca em evento/conta real.
//
// Uso (local, contra o docker-compose + `npm run start:dev`):
//   cd packages/load-test && npm install && npm run spectators
//
// Contra outro ambiente (ex. staging/produção, só se você tiver acesso
// às credenciais de lá): LOAD_TEST_API_URL, LOAD_TEST_DATABASE_URL e
// LOAD_TEST_JWT_SECRET têm que apontar pro MESMO ambiente entre si —
// o script nunca lê nem infere segredo de produção sozinho.

dotenv.config();
// Conveniência só pra rodar local: sem LOAD_TEST_JWT_SECRET/DATABASE_URL
// explícitos, cai pro .env do apps/api do próprio repo (mesmo valor que
// o servidor local já usa pra assinar/validar token).
dotenv.config({ path: path.resolve(__dirname, "../../../apps/api/.env") });

const API_URL = process.env.LOAD_TEST_API_URL ?? "http://localhost:3000";
const DATABASE_URL =
  process.env.LOAD_TEST_DATABASE_URL ??
  "postgres://easyjudge:easyjudge@localhost:5432/easyjudge";
const JWT_SECRET = process.env.LOAD_TEST_JWT_SECRET ?? process.env.JWT_SECRET;
const SPECTATOR_COUNT = Number(process.env.SPECTATOR_COUNT ?? 200);
const RAMP_UP_SECONDS = Number(process.env.RAMP_UP_SECONDS ?? 10);
const HOLD_SECONDS = Number(process.env.HOLD_SECONDS ?? 3);
const BROADCAST_TIMEOUT_SECONDS = Number(process.env.BROADCAST_TIMEOUT_SECONDS ?? 15);

interface SpectatorMetrics {
  connectMs?: number;
  restMs: number[];
  broadcastMs?: number;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mintToken(userId: string, role: string, secret: string): string {
  return jwt.sign({ sub: userId, role }, secret, { expiresIn: "7d" });
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarize(label: string, values: number[]): void {
  if (values.length === 0) {
    console.log(`${label}: sem amostras`);
    return;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  console.log(
    `${label}: n=${values.length} min=${sorted[0]}ms p50=${percentile(sorted, 50)}ms ` +
      `p95=${percentile(sorted, 95)}ms p99=${percentile(sorted, 99)}ms max=${sorted[sorted.length - 1]}ms avg=${avg.toFixed(0)}ms`,
  );
}

async function connectSpectator(
  index: number,
  userId: string,
  aliasId: string,
  eventId: string,
  secret: string,
  metrics: SpectatorMetrics,
  broadcastState: { sentAt: number | null },
): Promise<Socket> {
  const token = mintToken(userId, "athlete", secret);
  const connectStart = Date.now();
  const socket = io(API_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
  });

  await new Promise<void>((resolve) => {
    socket.once("connect", () => {
      metrics.connectMs = Date.now() - connectStart;
      socket.emit("join", { aliasId });
      resolve();
    });
    socket.once("connect_error", (err) => {
      metrics.error = `#${index} connect_error: ${err.message}`;
      resolve();
    });
  });

  socket.on("event.status_changed", () => {
    if (broadcastState.sentAt !== null && metrics.broadcastMs === undefined) {
      metrics.broadcastMs = Date.now() - broadcastState.sentAt;
    }
  });

  // Mesmas 3 leituras que a Home/painel ao vivo faz ao abrir o evento
  // (evento, cronograma, resultados) — dá pra ver o custo de leitura
  // sob concorrência, não só o custo de manter a conexão aberta.
  const endpoints = [
    `/events/${eventId}`,
    `/events/${eventId}/schedule/days`,
    `/events/${eventId}/scoring/results`,
  ];
  for (const p of endpoints) {
    const start = Date.now();
    try {
      const res = await fetch(`${API_URL}${p}`, { headers: { Authorization: `Bearer ${token}` } });
      await res.text();
      metrics.restMs.push(Date.now() - start);
      if (!res.ok) metrics.error = `#${index} ${p} -> ${res.status}`;
    } catch (e) {
      metrics.error = `#${index} ${p} -> ${(e as Error).message}`;
    }
  }

  return socket;
}

async function main(): Promise<void> {
  if (!JWT_SECRET) {
    console.error(
      "JWT_SECRET não encontrado. Defina LOAD_TEST_JWT_SECRET, ou rode localmente com apps/api/.env presente.",
    );
    process.exit(1);
  }
  const secret = JWT_SECRET;

  console.log(`Alvo: ${API_URL}`);
  console.log(
    `Espectadores: ${SPECTATOR_COUNT} | ramp-up: ${RAMP_UP_SECONDS}s | hold: ${HOLD_SECONDS}s | timeout de broadcast: ${BROADCAST_TIMEOUT_SECONDS}s`,
  );

  const pg = new Client({ connectionString: DATABASE_URL });
  await pg.connect();

  const runTag = `loadtest-${Date.now()}`;
  let adminId: string | undefined;
  let spectatorIds: string[] = [];
  let eventId: string | undefined;
  const sockets: Socket[] = [];

  try {
    const adminRes = await pg.query<{ id: string }>(
      `INSERT INTO users (role, first_name, last_name, email, active, email_verified_at)
       VALUES ('organization', 'Load Test', 'Admin', $1, true, now())
       RETURNING id`,
      [`${runTag}-admin@example.com`],
    );
    adminId = adminRes.rows[0].id;
    const adminToken = mintToken(adminId, "organization", secret);
    console.log(`Admin de teste: ${adminId}`);

    const todayIso = new Date().toISOString().slice(0, 10);
    const createRes = await fetch(`${API_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Teste de carga ${runTag}`,
        startDate: todayIso,
        location: "Load test",
        competitionDays: 1,
      }),
    });
    if (!createRes.ok) throw new Error(`Falha ao criar evento: ${createRes.status} ${await createRes.text()}`);
    const event = (await createRes.json()) as { id: string; aliasId: string };
    eventId = event.id;
    const aliasId = event.aliasId;
    console.log(`Evento de teste: ${eventId}`);

    const publishRes = await fetch(`${API_URL}/events/${eventId}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!publishRes.ok) throw new Error(`Falha ao publicar evento: ${publishRes.status} ${await publishRes.text()}`);
    console.log("Evento publicado.");

    console.log(`Criando ${SPECTATOR_COUNT} usuários de teste...`);
    const userValues: string[] = [];
    const userParams: unknown[] = [];
    for (let i = 0; i < SPECTATOR_COUNT; i++) {
      const base = i * 3;
      userValues.push(`($${base + 1}, $${base + 2}, $${base + 3}, 'athlete', true, now())`);
      userParams.push(`Espectador ${i}`, "Teste", `${runTag}-spectator-${i}@example.com`);
    }
    const usersRes = await pg.query<{ id: string }>(
      `INSERT INTO users (first_name, last_name, email, role, active, email_verified_at)
       VALUES ${userValues.join(",")}
       RETURNING id`,
      userParams,
    );
    spectatorIds = usersRes.rows.map((r) => r.id);

    const memberValues: string[] = [];
    const memberParams: unknown[] = [];
    for (let i = 0; i < spectatorIds.length; i++) {
      const base = i * 5;
      memberValues.push(
        `($${base + 1}, $${base + 2}, '{spectator}'::event_members_role_enum[], $${base + 3}, $${base + 4}, $${base + 5})`,
      );
      memberParams.push(aliasId, spectatorIds[i], `Espectador ${i}`, "Teste", `${runTag}-spectator-${i}@example.com`);
    }
    await pg.query(
      `INSERT INTO event_members (alias_id, user_id, roles, first_name, last_name, email)
       VALUES ${memberValues.join(",")}`,
      memberParams,
    );
    console.log(`${spectatorIds.length} espectadores de teste vinculados ao evento.`);

    const metricsList: SpectatorMetrics[] = spectatorIds.map(() => ({ restMs: [] }));
    const broadcastState = { sentAt: null as number | null };

    console.log("Conectando espectadores (ramp-up)...");
    await Promise.all(
      spectatorIds.map(
        (userId, i) =>
          new Promise<void>((resolve) => {
            const delay = Math.floor((i / spectatorIds.length) * RAMP_UP_SECONDS * 1000);
            setTimeout(() => {
              connectSpectator(i, userId, aliasId, eventId!, secret, metricsList[i], broadcastState)
                .then((socket) => {
                  sockets.push(socket);
                  resolve();
                })
                .catch((e) => {
                  metricsList[i].error = `#${i} exceção: ${(e as Error).message}`;
                  resolve();
                });
            }, delay);
          }),
      ),
    );
    console.log(`${sockets.length}/${SPECTATOR_COUNT} sockets conectados.`);

    await sleep(HOLD_SECONDS * 1000);

    console.log("Disparando POST /events/:id/start (emite event.status_changed pra sala toda)...");
    broadcastState.sentAt = Date.now();
    const startRes = await fetch(`${API_URL}/events/${eventId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!startRes.ok) {
      console.warn(`POST start falhou (${startRes.status}) — pulando medição de broadcast.`);
      broadcastState.sentAt = null;
    } else {
      console.log(`Aguardando ${BROADCAST_TIMEOUT_SECONDS}s pro broadcast chegar em todo mundo...`);
      await sleep(BROADCAST_TIMEOUT_SECONDS * 1000);
    }

    const connectMs = metricsList.map((m) => m.connectMs).filter((v): v is number => v !== undefined);
    const restMs = metricsList.flatMap((m) => m.restMs);
    const broadcastMs = metricsList.map((m) => m.broadcastMs).filter((v): v is number => v !== undefined);
    const errors = metricsList.filter((m) => m.error);

    console.log("\n=== Resultado ===");
    console.log(`Conectados: ${connectMs.length}/${SPECTATOR_COUNT}`);
    summarize("Conexão (socket)", connectMs);
    summarize("Leitura REST (evento+cronograma+resultados)", restMs);
    if (broadcastState.sentAt !== null) {
      console.log(`Receberam o broadcast: ${broadcastMs.length}/${sockets.length}`);
      summarize("Broadcast (start -> recebido)", broadcastMs);
    }
    console.log(`Erros: ${errors.length}`);
    for (const m of errors.slice(0, 15)) console.log(` - ${m.error}`);
    if (errors.length > 15) console.log(`   ... e mais ${errors.length - 15}`);
  } finally {
    console.log("\nLimpando dado de teste...");
    sockets.forEach((s) => s.close());

    if (eventId && adminId) {
      const adminToken = mintToken(adminId, "organization", secret);
      const delRes = await fetch(`${API_URL}/events/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      console.log(`DELETE evento de teste: HTTP ${delRes.status}`);
    }

    const testUserIds = [adminId, ...spectatorIds].filter((id): id is string => !!id);
    if (testUserIds.length) {
      await pg.query(`DELETE FROM event_activity_logs WHERE actor_id = ANY($1)`, [testUserIds]);
      await pg.query(`DELETE FROM email_verifications WHERE user_id = ANY($1)`, [testUserIds]);
      await pg.query(`DELETE FROM users WHERE id = ANY($1)`, [testUserIds]);
      console.log(`${testUserIds.length} usuários de teste removidos.`);
    }

    await pg.end();
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});

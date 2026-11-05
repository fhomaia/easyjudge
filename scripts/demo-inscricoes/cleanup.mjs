// Apaga o cenário da demo de inscrições (evento e as quatro contas demo.*).
// Uso: node scripts/demo-inscricoes/cleanup.mjs
import pg from 'pg';
import { API, DB_URL, cleanup } from './common.mjs';

async function call(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const db = new pg.Client({ connectionString: DB_URL });
await db.connect();
try {
  await cleanup(db, call);
  console.log('Limpeza concluída.');
} finally {
  await db.end();
}

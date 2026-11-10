// Configuração compartilhada pelo seed e pela limpeza da demo de inscrições.
export const API = process.env.DEMO_API_URL ?? 'http://localhost:3000';
import { readFileSync } from 'node:fs';

// Mesmo banco da API local (apps/api/.env).
const apiEnv = readFileSync(new URL('../../apps/api/.env', import.meta.url), 'utf8');
export const DB_URL =
  process.env.DEMO_DATABASE_URL ?? apiEnv.match(/^DATABASE_URL=(.*)$/m)[1].trim();
export const PASSWORD = 'Demo@2026!';

if (/neon\.tech|onrender\.com|cheercup\.com\.br/.test(API + DB_URL)) {
  throw new Error('Este script é só para o ambiente local.');
}

export const ACCOUNTS = {
  producer: {
    label: 'Produtora (Organização)',
    role: 'organization',
    firstName: 'Paula',
    lastName: 'Produtora',
    email: 'demo.produtora@cheercup.invalid',
    documentType: 'cpf',
    documentNumber: '52998224725',
    birthDate: '1988-04-12',
  },
  raios: {
    label: 'Programa Raios All Star',
    role: 'program',
    firstName: 'Raios All Star',
    email: 'demo.raios@cheercup.invalid',
    city: 'São Paulo',
    state: 'SP',
  },
  trovoes: {
    label: 'Programa Trovões Cheer (já inscrito)',
    role: 'program',
    firstName: 'Trovões Cheer',
    email: 'demo.trovoes@cheercup.invalid',
    city: 'Campinas',
    state: 'SP',
  },
  athlete: {
    label: 'Atleta Bia Martins',
    role: 'athlete',
    firstName: 'Bia',
    lastName: 'Martins',
    email: 'demo.bia@cheercup.invalid',
    birthDate: '2013-03-08',
  },
  // Elenco dos Raios. Davi passa da idade do Junior (pendência de idade) e
  // Luana já compete pelos Trovões (pendência de crossover).
  raiosRoster: [
    { firstName: 'Ana', lastName: 'Lima', email: 'demo.ana@cheercup.invalid', birthDate: '2013-05-20' },
    { firstName: 'Bruno', lastName: 'Costa', email: 'demo.bruno@cheercup.invalid', birthDate: '2012-09-02' },
    { firstName: 'Carla', lastName: 'Dias', email: 'demo.carla@cheercup.invalid', birthDate: '2013-01-15' },
    { firstName: 'Davi', lastName: 'Rocha', email: 'demo.davi@cheercup.invalid', birthDate: '2010-02-11' },
    { firstName: 'Elisa', lastName: 'Fontes', email: 'demo.elisa@cheercup.invalid', birthDate: '2014-07-30' },
    { firstName: 'Luana', lastName: 'Mendes', email: 'demo.luana@cheercup.invalid', birthDate: '2012-11-04' },
  ],
  trovoesRoster: [
    { firstName: 'Luana', lastName: 'Mendes', email: 'demo.luana@cheercup.invalid', birthDate: '2012-11-04' },
    { firstName: 'Marina', lastName: 'Alves', email: 'demo.marina@cheercup.invalid', birthDate: '2013-06-18' },
    { firstName: 'Nina', lastName: 'Barros', email: 'demo.nina@cheercup.invalid', birthDate: '2012-12-01' },
    { firstName: 'Olivia', lastName: 'Teles', email: 'demo.olivia@cheercup.invalid', birthDate: '2014-02-25' },
  ],
};

const MAIN = ['producer', 'raios', 'trovoes', 'athlete'];

// Exclui o evento da demo (pela produtora, o que apaga fichas, equipes,
// atletas e documentos) e depois as quatro contas (anonimizadas pelo
// "Excluir conta" normal, o que libera os emails).
export async function cleanup(db, call) {
  const tokens = {};
  for (const k of MAIN) {
    try {
      const { accessToken } = await call('POST', '/auth/login', null, {
        email: ACCOUNTS[k].email,
        password: PASSWORD,
      });
      tokens[k] = accessToken;
    } catch {
      // conta não existe
    }
  }
  if (tokens.producer) {
    const events = await call('GET', '/events', tokens.producer);
    for (const e of events) {
      if (e.name === 'Copa Demo Cheer Cup 2026') {
        await call('DELETE', `/events/${e.aliasId ?? e.id}`, tokens.producer);
      }
    }
  }
  for (const k of MAIN) {
    if (tokens[k]) {
      await call('POST', '/users/me/delete', tokens[k], { password: PASSWORD });
    }
  }
  // Contas que ficaram no meio do cadastro (sem senha) prendem o email.
  await db.query(
    `delete from users where email like 'demo.%@cheercup.invalid' and password_hash is null`,
  ).catch(() => {});
  if (Object.keys(tokens).length) {
    console.log(`Cenário anterior apagado (${Object.keys(tokens).join(', ')}).`);
  }
}

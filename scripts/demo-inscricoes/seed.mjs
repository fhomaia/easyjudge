// Monta o cenário da demo de inscrições no banco LOCAL (nunca em produção).
// Uso (da raiz do repo, com a API local rodando com RESEND_API_KEY= vazio):
//   node scripts/demo-inscricoes/seed.mjs
// Antes, apaga um cenário anterior (mesmo efeito de cleanup.mjs).
import pg from 'pg';
import { API, DB_URL, PASSWORD, ACCOUNTS, cleanup } from './common.mjs';

const db = new pg.Client({ connectionString: DB_URL });

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
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  }
  return data;
}

async function createAccount(acc) {
  const { userId } = await call('POST', '/auth/register', null, {
    role: acc.role,
    firstName: acc.firstName,
    lastName: acc.lastName ?? '',
    email: acc.email,
    documentType: acc.documentType,
    documentNumber: acc.documentNumber,
    birthDate: acc.birthDate,
    city: acc.city,
    state: acc.state,
    acceptedTerms: true,
  });
  const { rows } = await db.query(
    'select code from email_verifications where user_id = $1 order by created_at desc limit 1',
    [userId],
  );
  await call('POST', '/auth/verify-email', null, { userId, code: rows[0].code });
  const { accessToken } = await call('POST', '/auth/set-password', null, {
    userId,
    password: PASSWORD,
    confirmPassword: PASSWORD,
  });
  return accessToken;
}

async function addRoster(token, athletes) {
  const links = {};
  for (const a of athletes) {
    const link = await call('POST', '/athletes', token, {
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.email,
    });
    await call('PATCH', `/athletes/${link.id}/birth-date`, token, {
      birthDate: a.birthDate,
    });
    links[a.email] = link.id;
  }
  return links;
}

async function enrollAll(eventId, token, links, emails, entries) {
  for (const email of emails) {
    await call('POST', `/events/${eventId}/registration/athletes/${links[email]}/prepare`, token);
    await call('POST', `/events/${eventId}/registration/athletes/${links[email]}/enroll`, token, {
      entries,
    });
  }
}

function pickTemplate(templates, format) {
  const t =
    templates.find((t) => t.isOfficial && t.categoryFormat === format) ??
    templates.find((t) => t.categoryFormat === format) ??
    templates[0];
  return t.id;
}

async function main() {
  await db.connect();
  await cleanup(db, call);

  // Contas
  const producer = await createAccount(ACCOUNTS.producer);
  const trovoes = await createAccount(ACCOUNTS.trovoes);
  const raios = await createAccount(ACCOUNTS.raios);
  await createAccount(ACCOUNTS.athlete);

  // Evento (rascunho, inscrições abertas)
  const event = await call('POST', '/events', producer, {
    name: 'Copa Demo Cheer Cup 2026',
    startDate: '2026-11-21',
    competitionDays: 1,
    location: 'São Paulo/SP',
    venue: 'Ginásio do Ibirapuera',
    registrationDeadline: '2026-11-10',
  });
  const eventId = event.aliasId ?? event.id;

  // Categorias
  const templates = await call('GET', '/scoring-templates', producer);
  const base = { institution: 'all_star', warmupMinutes: 10 };
  const categories = {};
  const defs = [
    {
      key: 'tcJunior',
      name: 'Team Cheer • All Star • Junior • COED • Nível 2',
      categoryFormat: 'team_cheer',
      ageGroup: 'junior',
      gender: 'coed',
      level: 2,
      minAthletes: 5,
      maxAthletes: 24,
      presentationTimeSeconds: 150,
    },
    {
      key: 'tcYouth',
      name: 'Team Cheer • All Star • Youth • All Girl • Nível 1',
      categoryFormat: 'team_cheer',
      ageGroup: 'youth',
      gender: 'all_girl',
      level: 1,
      presentationTimeSeconds: 150,
    },
    {
      key: 'gsJunior',
      name: 'Group Stunt • All Star • Junior • All Girl • Nível 2',
      categoryFormat: 'group_stunt',
      ageGroup: 'junior',
      gender: 'all_girl',
      level: 2,
      presentationTimeSeconds: 60,
    },
  ];
  for (const { key, ...d } of defs) {
    const c = await call('POST', `/events/${eventId}/categories`, producer, {
      ...base,
      ...d,
      scoringTemplateId: pickTemplate(templates, d.categoryFormat),
    });
    categories[key] = c.id;
  }

  // Dados e documentos pedidos aos atletas
  await call('PUT', `/events/${eventId}/registration-settings`, producer, {
    allowSubmitWithoutDocuments: true,
    requirements: [
      { kind: 'date', preset: 'birth_date', label: 'Data de nascimento', required: true },
      {
        kind: 'document',
        preset: 'identity',
        label: 'Documento de identidade',
        description: 'RG ou certidão de nascimento, frente e verso.',
        required: true,
      },
      { kind: 'text', preset: 'phone', label: 'Telefone', required: false },
      {
        kind: 'select',
        label: 'Tamanho do uniforme',
        options: ['PP', 'P', 'M', 'G', 'GG'],
        required: false,
      },
    ],
  });

  // Libera as inscrições
  await call('PATCH', `/events/${eventId}`, producer, { registrationStatus: 'open' });
  const { eventCode: code } = await call('GET', `/events/${eventId}`, producer);

  // Trovões: já inscrito e com a ficha enviada (Luana também está no elenco
  // dos Raios: gera a pendência de crossover ao vivo).
  const trovoesLinks = await addRoster(trovoes, ACCOUNTS.trovoesRoster);
  await call('POST', '/events/join-by-code', trovoes, { code });
  let reg = await call('POST', `/events/${eventId}/registration`, trovoes, {});
  const trovoesProgramId = reg.program.id;
  const team = await call(
    'POST',
    `/events/${eventId}/programs/${trovoesProgramId}/teams`,
    trovoes,
    { name: 'Tempestade' },
  );
  await enrollAll(eventId, trovoes, trovoesLinks, Object.keys(trovoesLinks), [
    { teamId: team.id, categoryId: categories.gsJunior },
  ]);
  await call('POST', `/events/${eventId}/registration/submit`, trovoes);

  // Raios: ficha em rascunho com a equipe Faísca no Team Cheer Junior e 4
  // atletas inscritos (Davi já com a pendência de idade). Elisa e Luana
  // ficam pro vivo, e a Bia pede pelo lado do atleta.
  const raiosLinks = await addRoster(raios, ACCOUNTS.raiosRoster);
  await call('POST', '/events/join-by-code', raios, { code });
  reg = await call('POST', `/events/${eventId}/registration`, raios, {});
  const faisca = await call(
    'POST',
    `/events/${eventId}/programs/${reg.program.id}/teams`,
    raios,
    { name: 'Faísca' },
  );
  await enrollAll(
    eventId,
    raios,
    raiosLinks,
    ['demo.ana@cheercup.invalid', 'demo.bruno@cheercup.invalid', 'demo.carla@cheercup.invalid', 'demo.davi@cheercup.invalid'],
    [{ teamId: faisca.id, categoryId: categories.tcJunior }],
  );

  console.log('\nCenário pronto.');
  console.log(`Evento: Copa Demo Cheer Cup 2026 (id ${eventId})`);
  console.log(`Código do evento: ${code}`);
  console.log(`Senha de todas as contas: ${PASSWORD}`);
  for (const k of ['producer', 'raios', 'athlete', 'trovoes']) {
    console.log(`  ${ACCOUNTS[k].label}: ${ACCOUNTS[k].email}`);
  }
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());

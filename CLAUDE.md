# easyJudge

Plataforma SaaS para gestão de notas e resultados em tempo real em
competições de cheerleading. Usada por jurados (atribuem notas) e
produtores de evento (gerenciam a competição e acompanham o resultado).
Atletas terão acesso de consulta (própria nota + resultado por categoria),
mas essa jornada é a última a ser construída.

**Decisão de escopo (2026-07-12):** nesta fase, jurado (`JUDGE`) tem as
mesmas permissões de produtor (`ORGANIZATION`) — inclusive criar e
gerenciar eventos. Os papéis continuam distintos no enum `UserRole`
(reversível caso as funções se separem de novo); os guards de endpoints
de gestão de evento aceitam ambos via `@Roles(UserRole.JUDGE,
UserRole.ORGANIZATION)`.

**Atualização (2026-07-12): isso agora só vale pra quem pode CRIAR
eventos.** Depois de criado, quem enxerga/edita/publica um evento
específico é controlado por `EventMember` (membership por evento —
admin/judge/participant/spectator), não mais pelo `UserRole` global.
`GET /events`/`GET /events/:id` viraram totalmente membership-based:
mesmo um usuário `JUDGE`/`ORGANIZATION` só vê um evento se tiver uma
linha de `EventMember` para ele (não existe mais "qualquer jurado vê
qualquer evento" — isso era o comportamento antigo, revisado a pedido
do usuário). Ver seção "Eventos: versionamento e membership" mais
abaixo pra detalhes.

**Atualização (2026-07-19): `EventMember` virou uma linha por pessoa,
não por papel.** `role` (um só) virou `roles: EventMemberRole[]`
(array) — dá pra acumular mais de um papel no mesmo evento (ex.
ADMIN+ASSESSOR). `PARTICIPANT` foi renomeado pra `ASSESSOR`. `userId`
agora é nullable: dá pra adicionar alguém ao roster por nome+email
antes de ela ter conta na plataforma ("convite pendente"), reclamado
automaticamente no cadastro. Ver seção "Gerenciamento de acessos do
evento (`event-staff`)" mais abaixo pra detalhes.

Uso inicial: **somente desktop**. Mobile não é prioridade na POC.

## Requisitos não-negociáveis

- **Notas nunca podem ser perdidas.** Este é o requisito mais crítico do
  projeto. A arquitetura de scoring deve usar event sourcing (INSERT,
  nunca UPDATE, em tabela append-only) e buffer local no navegador
  (IndexedDB) com fila de retry, para sobreviver a queda de rede durante
  a competição.
- **Velocidade percebida.** Jurado atribui nota em tempo real; UI deve
  usar optimistic UI (nota aparece na tela antes da confirmação do
  servidor) em vez de spinners bloqueantes.
- **Minimizar custo, é uma POC.** Preferir serviços com free tier
  generoso (Neon ou Supabase para Postgres em produção; localmente
  usamos Docker).

## Stack decidida

**Backend:** NestJS + TypeScript + TypeORM + PostgreSQL
**Frontend:** React + Vite + TypeScript + TailwindCSS v4 + Zustand +
React Router + shadcn/ui (estilo `base-nova`, sobre Base UI — não Radix
diretamente) + Framer Motion (animações de entrada e do `BrandBackdrop`).
**Banco local:** Postgres via Docker Compose (`docker-compose.yml` na raiz)
**Realtime (planejado):** WebSocket (Socket.io) ou Supabase Realtime quando
migrarmos para produção — ainda não implementado.

### Por que essas escolhas (não revisitar sem motivo novo)

- React foi escolhido sobre vanilla TS/HTML/CSS puro: a diferença de
  performance não é relevante no volume de updates de uma tela de scoring;
  optimistic UI + boas animações resolvem a "sensação de velocidade".
- Postgres via Docker local agora, migração para Neon/Supabase só na hora
  de deploy real (evita custo de POC).
- Monorepo com npm workspaces (`apps/*`, `packages/*`) em vez de repos
  separados para front/back: tipos compartilhados, menos overhead de
  gerenciamento para time pequeno/solo nesta fase.
- Event sourcing nas notas (tabela `score_events` append-only, nunca
  UPDATE) em vez de armazenar só o valor atual: garante auditoria e
  elimina risco de sobrescrever/perder uma nota.
- Logos de evento/equipe: armazenamento local em disco (`uploads/`) por
  enquanto, mesmo raciocínio do Postgres — evita custo/complexidade de um
  provider de storage (S3, Cloudinary, Supabase Storage) antes de ter
  deploy real. Migrar para storage em nuvem junto com a migração do
  Postgres para produção.
- shadcn/ui em vez de construir os componentes do zero: acelera telas de
  formulário/popup/modal (boa parte do fluxo de auth e de criar evento),
  acessível por padrão, e o código do componente fica copiado no repo
  (`apps/web/src/components/ui/`), não é dependência de pacote — dá pra
  editar livremente sem "ejetar" nada.
- React Router para navegação: não estava no stack original do CLAUDE.md,
  mas é o padrão de fato para Vite+React e a jornada de auth já precisa
  de rotas protegidas (`/login` vs `/`) desde o primeiro dia.
- Token JWT guardado no `localStorage` via `zustand/persist` (não
  cookie/httpOnly) — simples o suficiente pra POC; revisitar para
  produção se segurança de XSS virar preocupação real.

## Estrutura do repositório

Cada domínio (`auth`, `users`, `events`, `categories`, `programs`,
`teams`, `judges`, `judging`, `schedule`, `scoring-templates`,
`regulations`, ...) é uma pasta autocontida em
`apps/api/src/`, com `controllers/` e `services/` como subpastas
próprias dentro dele (não pastas globais compartilhadas entre
domínios). `dto/`, `entities/`, `*.module.ts` ficam na raiz de cada
domínio. Mesmo padrão a seguir para os próximos domínios (`Routine`,
`ScoreEvent`, `Result`, etc).

```
easyjudge/
├── apps/
│   └── api/                    # NestJS
│       ├── src/
│       │   ├── auth/           # registro, verificação de email, senha, login, JWT
│       │   │   ├── controllers/
│       │   │   ├── services/   # AuthService, MailService (Resend, cai pra stub sem RESEND_API_KEY)
│       │   │   ├── dto/ entities/ guards/ decorators/ strategies/ types/
│       │   │   └── auth.module.ts
│       │   ├── users/          # entidade User e CRUD básico
│       │   │   ├── services/
│       │   │   ├── entities/
│       │   │   └── users.module.ts
│       │   ├── events/         # Event (jornada "criar evento", parte 1) +
│       │   │   │                # EventMember (roster/acesso, ver event-staff)
│       │   │   ├── controllers/ services/ dto/ entities/ enums/
│       │   │   ├── guards/     # EventMemberGuard (checa EventMember.roles pro :eventId da rota)
│       │   │   ├── decorators/ # @EventRoles (espelha @Roles, mas por evento)
│       │   │   └── events.module.ts   # exporta EventsService (usado por vários domínios filhos)
│       │   ├── categories/     # Category, aninhada em /events/:eventId/categories
│       │   │   ├── controllers/ services/ dto/ entities/
│       │   │   └── categories.module.ts
│       │   ├── programs/       # ProgramParticipation (a instituição/academia
│       │   │   │                # num evento) + ProgramProfile (perfil canônico,
│       │   │   │                # 1:1 com User role PROGRAM) + catálogo do produtor
│       │   │   ├── controllers/ services/ dto/ entities/
│       │   │   └── programs.module.ts  # exporta ProgramsService (usado por teams/auth)
│       │   ├── teams/          # Team, aninhada em
│       │   │   │                # /events/:eventId/programs/:programId/teams
│       │   │   │                # (+ EventTeamsController: todas as equipes do evento)
│       │   │   ├── controllers/ services/ dto/ entities/
│       │   │   └── teams.module.ts
│       │   ├── judges/         # JudgeParticipation + JudgeProfile — catálogo/perfil
│       │   │   │                # canônico de jurados (quem é jurado no evento)
│       │   │   ├── controllers/ services/ dto/ entities/
│       │   │   └── judges.module.ts
│       │   ├── judging/        # CriterionJudgeAssignment + SpecialRoleAssignment —
│       │   │   │                # escala de arbitragem (quem julga o quê, em qual pista)
│       │   │   ├── controllers/ services/ dto/ entities/ enums/
│       │   │   └── judging.module.ts
│       │   ├── schedule/       # ScheduleDay + ScheduleResource + ScheduleEntry —
│       │   │   │                # cronograma/timeline de apresentações do evento
│       │   │   ├── controllers/ services/ dto/ entities/ enums/
│       │   │   └── schedule.module.ts
│       │   ├── scoring-templates/  # ScoringTemplate + ScoringCriterion (árvore),
│       │   │   │                    # biblioteca pessoal do usuário, não presa a evento
│       │   │   ├── controllers/ services/ dto/ entities/ enums/
│       │   │   └── scoring-templates.module.ts  # exporta ScoringTemplatesService (usado por categories)
│       │   ├── regulations/    # Regulation + RegulationDocument, 1:1 com Event (por eventId)
│       │   │   ├── controllers/ services/ dto/ entities/ enums/ constants/
│       │   │   └── regulations.module.ts
│       │   ├── common/         # enums, validators e config compartilhados (CPF/CNPJ, senha forte, upload de logo/documento)
│       │   ├── migrations/     # migrations do TypeORM
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── data-source.ts      # config do TypeORM CLI (separado do app.module.ts)
│       └── .env                # DATABASE_URL, JWT_SECRET, PORT (não commitado)
│   └── web/                     # React + Vite (Tailwind v4, shadcn/ui, Zustand, React Router)
│       ├── src/
│       │   ├── api/            # client.ts — fetch wrapper para a API (via proxy /api)
│       │   ├── store/          # auth.ts — Zustand + persist (JWT no localStorage)
│       │   ├── pages/          # LoginPage, HomePage, EventSetupPage, EventStaffPage,
│       │   │   │                # CategoriesPage, ProgramsPage, RegulationPage,
│       │   │   │                # JudgingPage, SchedulePage,
│       │   │   │                # ScoringTemplatesListPage/BuilderPage
│       │   ├── components/     # RegisterDialog, ProtectedRoute, GuestRoute, FormError,
│       │   │   │                # BrandBackdrop (raio riscando a tela -> clarão -> split azul/amarelo)
│       │   │   └── ui/         # componentes shadcn/ui (gerados via CLI, editáveis)
│       │   ├── lib/utils.ts    # helper `cn` (shadcn), scheduleTime.ts, scheduleConflicts.ts,
│       │   │   │                # dndProjection.ts, useEventSetupGuard.ts, eventMemberRoles.ts
│       │   └── App.tsx         # rotas
│       ├── public/
│       │   ├── logo.png        # logo (fornecida pelo usuário, ver "Status atual")
│       │   └── favicon.png     # favicon (idem)
│       ├── components.json     # config do shadcn/ui CLI
│       └── vite.config.ts      # alias @/* -> src/*, proxy /api -> localhost:3000
├── packages/                   # vazio por enquanto (shared-types entra quando fizer sentido)
├── docker-compose.yml          # Postgres local
└── package.json                # raiz do workspace
```

## Jornada do usuário (ordem de implementação)

Jurado e produtor têm a mesma jornada de auth/cadastro; o que diverge é o
que cada um vê/faz depois de logado (controlado por `role` + guards).

Ordem de construção definida:
1. **Auth + User** — ✅ feito (ver "Status atual" abaixo)
2. **Jornada do jurado** — login → ver evento/rotinas atribuídas → atribuir
   notas em tempo real (a *escala* de arbitragem — quem julga o quê, em
   qual pista — já existe, ver módulo `judging`; falta a tela do jurado
   pra efetivamente lançar notas, que ainda não existe)
3. **Jornada do produtor** — criar evento, cadastrar jurados/rotinas, painel
   de acompanhamento em tempo real, apuração de resultado (o setup do
   evento, catálogo de jurados/programas e cronograma já existem; falta o
   painel de acompanhamento em tempo real e a apuração de resultado)
4. **Jornada do atleta** — ver própria nota + resultado geral das categorias
   em que competiu (ainda não iniciado)

Fluxo de cadastro completo (já implementado):
login → "criar conta" (popup) → escolhe role (judge/athlete/organization)
→ preenche nome, sobrenome, documento (CPF/CNPJ), email, nome da
equipe/instituição (opcional) → recebe email com código de 6 dígitos →
digita código → tela de definir senha (mín. 8 caracteres, maiúscula,
número, caractere especial) + confirmar senha → conta criada e já loga
(retorna JWT) → redireciona para home.

## Status atual (o que já está pronto e testado)

- Monorepo configurado (npm workspaces, `apps/api` gerado via `nest new`)
- Postgres local rodando via Docker Compose, extensão `uuid-ossp` habilitada
- Módulos `auth` e `users` implementados:
  - `POST /auth/register` — cria usuário pendente, dispara código de verificação
  - `POST /auth/verify-email` — valida código (expira em 15 min, uso único)
  - `POST /auth/resend-code/:userId` — reenvio com throttle de 60s
  - `POST /auth/set-password` — define senha (bcrypt, 12 rounds) e já retorna JWT
  - `POST /auth/login` — login padrão para acessos futuros
- Validação de CPF/CNPJ real (dígito verificador via `cpf-cnpj-validator`)
- Validação de senha forte via decorator customizado
- Guards de role prontos (`@Roles(UserRole.JUDGE)` + `RolesGuard`), ainda
  não aplicados em nenhum endpoint (serão usados a partir da jornada do jurado)
- `MailService` envia email de verdade via **Resend** (2026-07-12) —
  `RESEND_API_KEY` no `.env` (usuário criou a conta e gerou a key na
  hora). Sem `RESEND_API_KEY` configurada, cai automaticamente pro
  comportamento antigo (stub, só loga no console) — útil pra dev local
  sem precisar de credencial real. **Domínio ainda não verificado no
  Resend** → remetente obrigatoriamente `onboarding@resend.dev`
  (sandbox), que só entrega pro email da própria conta Resend
  (`easyjudgepro@gmail.com`).
  **`EMAIL_OVERRIDE_TO` (2026-07-12):** registrar com qualquer email que
  não fosse `easyjudgepro@gmail.com` dava `500` (Resend rejeita no
  sandbox). Enquanto o domínio não é verificado, `EMAIL_OVERRIDE_TO`
  (setado em `apps/api/.env`, não commitado, valor atual
  `easyjudgepro@gmail.com`) força **todo** email de verificação pra
  esse endereço, não importa o email real do cadastro — o assunto vira
  `[teste: <email real>] ...` e o corpo mostra qual cadastro é, pra dar
  pra diferenciar. Remover essa variável do `.env` quando um domínio
  próprio for verificado no Resend (aí cada usuário recebe no próprio
  email de novo). Sem `EMAIL_OVERRIDE_TO` setada, comportamento normal
  (tenta entregar pro email real, falha se for fora do sandbox).
  **Gotcha:** quando o envio falha (exceção não tratada em
  `issueVerificationCode`), o usuário pendente e o código **já foram
  salvos no banco** antes do erro — só não retornam o `userId` pro
  chamador. Se isso acontecer de novo (envio falhando por outro
  motivo), dá pra recuperar via
  `SELECT u.id, ev.code FROM users u JOIN email_verifications ev ON
  ev.user_id = u.id WHERE u.email = '...' ORDER BY ev.created_at DESC
  LIMIT 1;` no Postgres local (usar `pg` do Node se não tiver `psql`
  instalado no host — `docker exec` pede senha de sudo interativa, não
  dá pra rodar direto).
- **Email só reserva depois da senha definida (2026-07-12).**
  `UsersService.createPendingUser` mudou de novo: antes checava
  `emailVerifiedAt` pra decidir se o email podia ser reusado (ver
  gotcha de "reuso de email não confirmado" acima); agora checa
  `passwordHash` — mesmo com o código já confirmado, se o usuário nunca
  completou `set-password` (ex: perdeu acesso à página no meio do
  fluxo), o email continua liberado pra um cadastro novo apagar o
  pendente e seguir. Só bloqueia (`409`) quando existe um usuário com
  `passwordHash` preenchido pra aquele email — ou seja, cadastro
  **completo** de verdade. **Gotcha:** `passwordHash` tem
  `select: false` na entidade (`User`), então o `findOne` normal do
  TypeORM não traz essa coluna — precisa de
  `.createQueryBuilder('user').addSelect('user.passwordHash')...`
  (mesmo padrão já usado em `findByEmailWithPassword`), senão o campo
  vem sempre `undefined` mesmo quando tem hash salvo no banco, e a
  checagem passa incorretamente.
- Migration inicial (`InitialSchema`) rodada com sucesso — tabelas `users`
  e `email_verifications` existem no Postgres local
- Servidor sobe e todas as rotas de auth estão mapeadas e funcionando
- Fluxo completo `/auth/register` → `/auth/verify-email` → `/auth/set-password`
  → `/auth/login` validado via curl (2026-07-12), sem bugs
- Módulos `events` + `categories` + `teams` implementados (jornada "criar
  evento", parte 1 — registrar evento, categorias e equipes; regulamento
  e regra de pontuação ficam para uma próxima iteração). Domínios
  separados desde 2026-07-12 (antes tudo vivia em `events`); `categories`
  e `teams` importam `EventsModule` e usam `EventsService.findEventOrThrow`
  (método público, exportado) para validar que o evento existe antes de
  criar o recurso filho — ver gotcha sobre esse padrão abaixo:
  - `Event`: nome, `startDate`, `competitionDays`, `location`, `createdById`
  - `Category`: nome, vinculada a um evento (`eventId`) — desde
    2026-07-14 também exige um `scoringTemplateId` (ver seção de
    `scoring-templates`/categorias mais abaixo), regra de pontuação
    virou uma entidade própria de verdade, não mais "a detalhar"
  - `Team`: nome, email, cidade, estado (UF), vinculada a um evento
  - `POST /events` — cria evento (`@Roles(JUDGE, ORGANIZATION)`)
  - `GET /events` / `GET /events/:id` — qualquer usuário autenticado
    (o `:id` retorna o evento com `categories` e `teams`)
  - `POST /events/:eventId/categories` — adiciona categoria ao evento
    (`CategoriesController`)
  - `POST /events/:eventId/teams` — adiciona equipe ao evento
    (`TeamsController`)
  - Guards `JwtAuthGuard` + `RolesGuard` aplicados pela primeira vez
    (primeiro uso real de `request.user`, tipado via
    `AuthenticatedRequest` em `auth/types/`)
  - Fluxo completo validado via curl em 2026-07-12: criação de evento →
    categoria → equipe → GET com relações (jurado) e 403 para atleta
  - Logo opcional para `Event` e `Team` (`logoUrl`, nullable): upload via
    `POST /events/:id/logo` e `POST /events/:eventId/teams/:teamId/logo`
    (multipart, campo `file`), armazenamento local em disco
    (`apps/api/uploads/logos/`, gitignored) servido em `/uploads/...`.
    PNG/JPEG/WEBP/SVG, máx. 5MB — validado via curl em 2026-07-12
    (upload ok, tipo inválido → 400, sem arquivo → 400)
- **Frontend iniciado** (`apps/web`, 2026-07-12): Vite + React + TS +
  Tailwind v4 + shadcn/ui + Zustand + React Router. Primeira fatia
  vertical construída — fluxo de auth completo:
  - `LoginPage`: email/senha → `POST /auth/login`
  - `RegisterDialog` (popup "criar conta") — redesenhado em 2026-07-12 a
    pedido do usuário como um **assistente conversacional**: uma
    pergunta por etapa (`STEPS` array: role → firstName → lastName →
    documentType → documentNumber → email → team → **summary** → verify
    → password → confirmPassword), com barra de progresso, botão
    "Voltar" (desabilitado nos 3 últimos passos — `LOCKED_STEPS —` já
    criaram a conta pendente e o código no backend, voltar não faz
    sentido ali) e transição de slide entre perguntas (framer-motion
    `AnimatePresence`). O papel (`role`) usa `Select` (shadcn/Base UI)
    em vez do `RadioGroup` anterior, a pedido do usuário. O passo
    `summary` mostra um resumo de todas as respostas antes de chamar
    `POST /auth/register` (que dispara o email de verificação) — só
    depois disso os dados vão pro backend. `documentNumber` valida
    CPF/CNPJ no cliente (`cpf-cnpj-validator`, mesma lib do backend,
    adicionada como dependência do frontend) antes de deixar avançar.
    Fluxo completo: escolha de papel + dados/documento/email → resumo →
    `POST /auth/register`; código de verificação → `POST
    /auth/verify-email` (com reenvio); definir senha → `POST
    /auth/set-password` (retorna JWT, já loga)
  - `useAuthStore` (Zustand + persist): guarda `accessToken` decodificado
    (`userId`, `role`) no `localStorage`
  - `ProtectedRoute` (`/`) e `GuestRoute` (`/login`) — redirecionam
    conforme sessão
  - `vite.config.ts` faz proxy de `/api/*` → `http://localhost:3000/*`
    em dev (evita hardcode de URL absoluta e problema de CORS)
  - Testado ponta a ponta com Playwright headless em 2026-07-12: cadastro
    completo → código real lido do log do backend → definir senha →
    home; sessão persiste a reload; logout funciona; nenhum erro de
    console. Dois bugs reais pegos nesse teste e corrigidos: (1) `id`
    duplicado entre inputs da `LoginPage` e do `RegisterDialog` (o
    dialog é um portal, mas os campos da página por trás continuam no
    DOM) fazia o preenchimento de email cair no campo errado — todos os
    ids do `RegisterDialog` agora têm prefixo `register-`; (2) o botão
    final do dialog tinha o mesmo texto ("Criar conta") do link que abre
    o dialog — renomeado para "Finalizar cadastro"
- **Identidade visual aplicada** (2026-07-12): logo e favicon fornecidos
  pelo usuário (gerados em Gemini, tema raio + cronômetro + cheerleader)
  em `apps/web/public/logo.png` e `public/favicon.png` (ambos recortados
  do espaço em branco original via PIL; o favicon foi convertido pra
  quadrado 512×512, o logo teve o fundo branco convertido pra transparente).
  Paleta de marca (azul + amarelo, ver `--brand-*` em `src/index.css`):
  `--brand-navy #14293d`, `--brand-blue #1f6fb0`, `--brand-yellow #f7a828`.
  Essas cores substituíram a paleta neutra padrão do shadcn nas variáveis
  semânticas (`--primary`, `--accent`, `--ring` etc.), então todo
  componente shadcn já existente herdou o tema automaticamente, sem
  precisar editar cada componente individualmente. Existe um bloco
  `.dark` com variante escura da paleta, mas **não há toggle de tema
  ainda** — fica pronto pra quando isso for pedido.
  `BrandBackdrop` (`src/components/BrandBackdrop.tsx`, redesenhado em
  2026-07-12 a pedido do usuário — "queria um background mais
  impactante... como um raio dividindo a tela"): animação de entrada em
  3 fases controladas por `useState<Phase>` + `setTimeout` (não é só
  CSS — a sequência é: 1. **strike**, ~650ms: fundo azul-marinho escuro
  + um traço em zigue-zague (silhueta clássica de raio, SVG `<polyline>`
  com `pathLength` animado por `framer-motion`) "risca" a tela com brilho
  via `drop-shadow`; 2. **flash**, ~250ms: `<div>` branco com opacity
  `[0,1,0]`, tipo flash de câmera; 3. **done**: os dois `<polygon>`
  (mesmos vértices do zigue-zague do raio, um do lado esquerdo e outro
  do direito da tela) ficam com opacity 1, revelando a tela dividida em
  azul/amarelo pelo formato do raio, com uma borda branca fina (mesmo
  `polyline` do zigue-zague, agora com `stroke="white"`) marcando a
  divisão; o conteúdo da página (logo, card) entra com delay
  (~0.95–1.1s) pra não competir com o "impacto" do raio. As estrelas
  flutuantes da primeira versão foram removidas a pedido do usuário
  (2026-07-12). SVG usa `viewBox="0 0 160 100"` com
  `preserveAspectRatio="xMidYMid slice"` (não `"none"`) — evitar
  `"none"` aqui é importante: estica x/y de forma independente e
  distorce a espessura do traço do raio de forma inconsistente conforme
  a proporção da tela. A animação roda de novo a cada vez que
  `LoginPage`/`HomePage` remonta (sem persistir estado — isso é
  intencional, é o efeito de entrada da tela). Framer Motion (já estava
  no stack planejado, não usado até então) também entrou pra animação
  de entrada do logo (spring bounce) e dos cards (fade+slide).
  **Fotos no fundo (2026-07-12, a pedido do usuário):** em vez de cor
  chapada, cada metade mostra uma foto de ação de cheerleading
  (`public/bg-left.webp` / `public/bg-right.webp`, fornecidas pelo
  usuário — já trocadas três vezes) com uma camada de cor da marca por
  cima em opacidade reduzida (`opacity={0.55}`) pra manter a leitura
  "lado azul / lado amarelo". `bg-left.webp` na versão atual é um
  recorte de 1400×2139 (cortado do original 3333×5000 já com o assunto
  posicionado à esquerda, ver gotcha de deslocamento abaixo — não é o
  arquivo inteiro redimensionado); `bg-right.webp` é paisagem 1280×856,
  sem redimensionar (68KB, já leve). Os parâmetros de enquadramento
  (`x`/`y`/`width`/`height` do `<image>`, ver gotcha abaixo) são
  calculados pra proporção específica de cada arquivo — **trocar a foto
  por uma de proporção bem diferente exige recalcular esses valores**,
  não é só substituir o arquivo.
  Implementado com `<clipPath>` + `<image>` do SVG (não `<div>` com
  `background-image` + CSS `clip-path`) — importante: as duas fotos, o
  traço branco divisório e as regiões coloridas precisam estar todos no
  **mesmo sistema de coordenadas SVG** (`viewBox` + mesmo
  `preserveAspectRatio="xMidYMid slice"`) pra alinhar perfeitamente; um
  `<div>` com CSS `clip-path: polygon(...)` em `%` teria esticado de
  forma independente em x/y (sem o comportamento "slice"/crop do SVG) e
  a borda branca ficaria desalinhada da borda das fotos em qualquer
  proporção de tela diferente de 160:100.
- **Redesenho "sofisticado" do login/cadastro** (2026-07-12, a pedido
  do usuário — "muito espremido", "quinas bem arredondadas", "cores
  mais vivas"): fonte trocada de Geist pra Plus Jakarta Sans
  (`@fontsource-variable/plus-jakarta-sans`); `--radius` reduzido de
  `0.75rem` pra `0.375rem` (cantos bem menos arredondados, afeta
  Card/Button/Input/Dialog/Select juntos via `--radius-sm/md/lg/xl`
  derivados); nova variável `--soft-primary` (`#3d6485` light /
  `#6a97b8` dark) — cor **dessaturada**, separada de `--brand-blue`
  (que continua vivo só no `BrandBackdrop`), usada em `--primary` e
  `--ring` pra suavizar botões/foco sem mexer no fundo; `Button` e
  `Input`/`Select` ganharam tamanho padrão maior (`h-8`→`h-11`→`h-12`
  numa segunda rodada, padding maior, `text-sm`→`text-base`);
  espaçamento (`gap-4`→`gap-5`/`6`, padding do `Card`/`DialogContent`
  aumentado via `[--card-spacing:...]` e `p-8`→`p-10`, `DialogContent`
  `sm:max-w-md`→`sm:max-w-lg`, perguntas do wizard `text-lg`→`text-xl`
  pra acompanhar o popup maior).
  **Destaque de foco (2026-07-12):** `Input`/`Select` ganharam
  `focus-visible:border-primary` + `focus-visible:bg-primary/[0.06]`
  (fundo azul clarinho) além do `ring` que já existia — borda e fundo
  mudam junto quando o campo está ativo. Achei um "bug" que não era: ao
  testar `getComputedStyle` logo após o clique, a cor ainda aparecia
  cinza — não é falha do CSS, é `transition-colors` (rodando por
  ~150-200ms) ainda no meio da transição; só fica visível a cor final
  se esperar a transição terminar antes de checar. Ao testar
  visualmente/programaticamente um estado com transição, sempre dar
  tempo pra ela assentar antes de tirar conclusão.
  **Etapas de documento unificadas (2026-07-12):** os passos
  `documentType` (CPF/CNPJ) e `documentNumber` do wizard viraram um só
  (`document`) — pergunta única "Qual é o seu documento?" com o
  `RadioGroup` e o `Input` juntos, validação de CPF/CNPJ roda no
  submit desse passo combinado (função renomeada de
  `submitDocumentNumber` pra `submitDocument`).
  **Etapas de senha unificadas + validação em tempo real (2026-07-12):**
  mesmo padrão aplicado a `password`/`confirmPassword` — viraram um só
  passo `password`, com os dois campos juntos. A regra de senha forte
  (`PASSWORD_RULES` em `RegisterDialog.tsx`) espelha exatamente
  `common/validators/strong-password.validator.ts` do backend (mín. 8
  caracteres, maiúscula, número, caractere especial) e é avaliada a
  cada tecla — uma checklist com ✓/✗ por regra aparece embaixo do campo
  de senha, e o botão "Finalizar cadastro" só habilita quando todas as
  regras passam **e** as senhas coincidem (chega a validar de novo no
  submit também, por segurança). `STEPS` caiu pra 9 itens.
  **Gotcha de centralização no `CardHeader` (2026-07-12):** a logo
  (`logo.png`, lockup completo) dentro do card de login parecia
  desalinhada mesmo com `items-center`. Diagnóstico errado na primeira
  tentativa (achei que era peso visual do ícone vs texto — cheguei a
  trocar por `favicon.png` + texto HTML, o usuário corrigiu: "é pra ser
  a logo mesmo"). Causa real: `CardHeader` (`card.tsx`) usa **CSS Grid**
  (`grid auto-rows-min`), não Flexbox — `items-center` num grid controla
  `align-items` (eixo cruzado/vertical), **não centraliza
  horizontalmente**. Precisa de `justify-items-center` (equivalente
  grid do `justify-content-center`/`items-center` do flex) ou `mx-auto`
  no filho. Corrigido com `className="justify-items-center ..."` no
  `CardHeader` + `mx-auto` na `<img>`. Confirmado por medição real (PIL
  `getbbox()`) que o arquivo `logo.png` já tinha margens simétricas
  (20px/20px esquerda/direita) — o problema nunca foi o asset, foi a
  classe Tailwind errada para o tipo de container.
  **Gotchas de enquadramento das fotos (2026-07-12):**
  - Cada `<image>` precisa ser ajustada (`x`/`width`) ao box da sua
    própria metade visível, não à tela inteira. A primeira versão usava
    `x={0} width={160}` (viewBox inteiro) nas duas fotos antes de
    recortar — `preserveAspectRatio="xMidYMid slice"` centralizava cada
    foto no meio da **tela toda** (atrás do card/logo) e só a borda de
    cada foto ficava visível na metade recortada.
  - **Aumentar o box do `<image>` para "diminuir o zoom" faz o
    contrário — aumenta o zoom.** Com `slice` (cover), o fator de escala
    é `max(box_largura/img_largura, box_altura/img_altura)`; crescer o
    box mantendo a mesma proporção só aumenta esse fator (a imagem fica
    **mais** ampliada, não menos). Pra reduzir o zoom de verdade, o
    `width`/`height`/`x`/`y` do `<image>` agora são calculados
    manualmente com um fator de escala menor (mostra mais da foto), e
    um `<rect>` da cor da marca sólida fica **atrás** da imagem — como
    a foto nesse zoom mais confortável não cobre 100% da região (sobra
    uma faixa fina no topo/base), essa faixa aparece na cor da marca em
    vez de vazio/branco. A camada de tint translúcida (`opacity: 0.55`)
    continua por cima de tudo, igual antes.
  - **Deslocar via `x` negativo + `width` maior que o necessário
    (zoom) funciona, mas custa nitidez** (2026-07-12, usuário reportou
    perda de qualidade). Motivo: `width`/`height` acima do mínimo de
    cobertura fazem o navegador escalar os pixels da foto pra cima
    (upscale) além da resolução nativa do arquivo — em telas de alta
    densidade (Retina/2x) isso fica visível rápido. Tentamos
    `x={-20} width={125}` (deslocamento pequeno demais, ~7.5% da
    largura da tela) e depois `x={-60} width={180} height={270}`
    (deslocamento visível, mas já upscalando ~1.8x o necessário).
  - **Solução final: pré-recortar a imagem original em alta resolução**
    (não a de trabalho, já reduzida) com o assunto posicionado onde
    precisa, em vez de deslocar em runtime via `x`/`width` no SVG. Com
    o Python original (`~/Downloads/cheer-lib.webp`, 3333×5000) ainda
    disponível, recortamos a região `(1170, 450, 2970, 3200)` — a
    atleta cai no terço esquerdo do recorte — e redimensionamos pra
    1400px de largura (`bg-left.webp` final, aspecto 0.6545). Resultado:
    `<image>` volta a usar `width={100}` **exatamente igual à região
    visível** (cobertura mínima, zero upscale extra) — só `y={-5}
    height={153}` pro leve corte vertical (mesma técnica de faixa de
    cor no rodapé). Lição: quando "mover o assunto" exige um
    deslocamento grande, mexer no arquivo de origem (com o original em
    alta resolução) é melhor que forçar zoom via `x`/`width` no SVG —
    preserva nitidez porque a imagem final nunca precisa escalar acima
    da sua resolução nativa.
- **Máscara de CPF/CNPJ + reuso de email não confirmado** (2026-07-12):
  - `apps/web/src/lib/masks.ts` (`formatCpf`/`formatCnpj`) formata o
    campo de documento em tempo real (`529.982.247-25` /
    `00.000.000/0000-00`) conforme o usuário digita, e reformata na
    hora se ele trocar CPF↔CNPJ com texto já digitado. O valor mascarado
    fica no estado do form (bom pra exibir no resumo), mas é enviado
    pro backend sem máscara (`.replace(/\D/g, "")` em `submitSummary`)
    — o back sempre validou dígitos limpos. Campo de email só recebe
    `.trim()` (sem forçar minúsculas — mudaria o que o usuário digitou
    em vez de só limpar espaço acidental).
  - **Backend: email de cadastro não confirmado não fica reservado**
    (`UsersService.createPendingUser`). Antes, qualquer linha existente
    com aquele email bloqueava um novo cadastro, mesmo que o usuário
    nunca tivesse confirmado (cadastro abandonado/typo travava o email
    pra sempre). Agora: se existe um usuário com esse email mas
    `emailVerifiedAt` é `null`, o registro pendente é **deletado**
    (cascata remove os `email_verifications`) e o cadastro novo segue
    normalmente; só bloqueia (`409`) se o usuário existente já
    confirmou o email. A mesma lógica **não** foi aplicada a
    `documentNumber` — só o comportamento de email foi pedido.
- **Seleção de tipo de conta em estilo Typeform + remoção do anel de foco
  (2026-07-12):**
  - Pergunta do primeiro passo trocada para "Qual será seu tipo de
    conta?" (era "Você é jurado, produtor ou atleta?").
  - `Input`/`Select` (`components/ui/input.tsx`,
    `components/ui/select.tsx`) perderam o `focus-visible:ring-*` —
    agora só trocam `border`/`bg` sutilmente no foco
    (`focus-visible:border-primary focus-visible:bg-primary/[0.06]`),
    sem shadow/anel, a pedido do usuário.
  - O passo `role` trocou o `Select` (dropdown escondido) por
    `OptionCard` — caixas largas com todas as opções visíveis ao mesmo
    tempo (`RadioGroupItem` com `className="sr-only"`, sem bolinha de
    radio visível; o estado selecionado já aparece pela borda/fundo
    azul da própria caixa via `has-[[data-checked]]:...`). O passo
    `document` (CPF/CNPJ) usa o mesmo componente.
  - **Hover com alpha não compõe sobre fundo opaco.**
    `hover:bg-muted/70` (e a primeira tentativa de correção,
    `hover:bg-black/[0.06]`) ficaram quase imperceptíveis — uma
    `background-color` com canal alfa substitui a propriedade inteira e
    mistura com o que está **atrás** do elemento (o card branco do
    dialog), não com o próprio fundo opaco de repouso do elemento.
    Confirmado via `getComputedStyle` que a regra CSS aplicava, mas o
    delta visual era baixo demais. Corrigido com `hover:bg-primary/10`
    (azul claro translúcido sobre o primary) — o usuário pediu
    explicitamente "azul claro" depois de rejeitar um cinza opaco
    intermediário.
  - **Avanço automático ao clicar numa opção (`role`), com um gotcha de
    clique duplicado:** o Base UI `Radio.Root` renderiza um
    `<input type="radio">` nativo oculto (`clip-path`/1px, mas não
    `display:none`) como **irmão** do `<span role="radio">` visível,
    dentro do `<label>` — usado só pra semântica de formulário. Um
    clique em qualquer ponto do `<label>` (inclusive no texto) é
    encaminhado pelo navegador para esse `<input>`, e o clique
    encaminhado também sobe (bubble) pelo próprio `<label>`. Colocar o
    handler direto no `onClick` do `<label>` disparava a função **duas
    vezes por clique** (um pelo clique original que já nasceu dentro do
    label, outro pelo clique sintético encaminhado ao input) — isso
    pulava dois passos do wizard de uma vez ao clicar na opção que já
    vinha selecionada por padrão (`role: "judge"` é o valor inicial do
    form). A correção foi filtrar no handler do `<label>`:
    `if ((e.target as HTMLElement).tagName === "INPUT") onSelect()` —
    só reage ao clique que efetivamente chegou no input nativo
    (exatamente um por interação), ignorando o bubble do clique
    original. `onValueChange` do `RadioGroup` continua tratando a troca
    de valor normalmente; o `onSelect` do `OptionCard` só cobre o caso
    de reclicar a opção **já selecionada** (onde `onValueChange` do
    Base UI não dispara, por não haver mudança de valor).
- **Tipo de conta "Ginásio" adicionado (2026-07-12):** novo valor
  `UserRole.GYM = 'gym'`
  (`apps/api/src/common/enums/user-role.enum.ts`), replicado no
  frontend (`UserRole` em `api/client.ts`, `ROLE_LABELS` em
  `RegisterDialog.tsx` e `HomePage.tsx`, rótulo "Ginásio"). Rótulo do
  `organization` também mudou de "Produtor / Organização" pra "Produtor
  esportivo". Como o enum de role é um `enum` nativo do Postgres
  (`users_role_enum`), precisou de migration
  (`AddGymRoleToUsers1783908166997`) rodando `ALTER TYPE ... ADD
  VALUE 'gym'` — o `down()` recria o tipo do zero (Postgres não tem
  `DROP VALUE` de enum) via rename→create→cast→drop do tipo antigo.
  `GYM` **não** foi adicionado aos `@Roles(UserRole.JUDGE,
  UserRole.ORGANIZATION)` dos controllers de `events`/`categories`/
  `teams` — segue o mesmo raciocínio já aplicado a `ATHLETE`: contas de
  ginásio são participantes, não gerenciam eventos.
  **Nota:** o valor passou primeiro por uma rodada como `UserRole.TEAM
  = 'team'` / rótulo "Equipe" (migration `AddTeamRoleToUsers...`) antes
  do usuário decidir que o conceito correto é "Ginásio", não "Equipe" —
  a migration antiga foi revertida (`migration:revert`) e substituída
  pela versão `gym` acima, já que nada tinha sido commitado ainda.
  **Ordem das opções (2026-07-12):** a pedido do usuário, a ordem no
  passo `role` é Produtor esportivo → Jurado → Ginásio → Atleta — como
  as opções vêm de `Object.keys(ROLE_LABELS)`, a ordem é só a ordem de
  inserção das chaves no objeto `ROLE_LABELS` em `RegisterDialog.tsx`
  (`organization`, `judge`, `gym`, `athlete`, nessa ordem).
  **Atualização (2026-07-14): renomeado de novo, "Ginásio"/`GYM` virou
  "Programa"/`UserRole.PROGRAM = 'program'`** (migration
  `RenameGymRoleToProgram`, mesmo procedimento de rename→create→cast→drop
  do tipo enum do Postgres já usado no rename `TEAM`→`GYM` anterior).
  Rótulo no frontend (`ROLE_LABELS`) também virou "Programa". O restante
  do raciocínio desta seção (não gerencia eventos, ordem das opções)
  continua valendo, só o nome mudou.
  **Gotcha de altura fixa cortando a 4ª opção (2026-07-12):** o wizard
  usa `AnimatePresence` com cada passo em `position: absolute inset-0`
  dentro de um wrapper `relative min-h-[Npx] overflow-hidden` — isso é
  proposital (evita "pulo" de layout ao trocar de passo, já que
  elementos absolutamente posicionados não contribuem pra altura do
  pai). Mas por serem `absolute`, a altura visível do passo fica
  limitada à altura do wrapper (`min-h`), não ao conteúdo do próprio
  passo — um passo mais alto que o wrapper é cortado por
  `overflow-hidden`. Com a 4ª opção (`Ginásio`) adicionada, o passo
  `role` passou a precisar de ~316–340px (medido via
  `scrollHeight`/Playwright) contra os `min-h-[300px]` antigos, cortando
  a última caixa. Corrigido subindo pra `min-h-[340px]`. **Sempre que um
  passo ganhar mais conteúdo** (mais opções, mais campos), reconferir
  esse valor — ele precisa acomodar o passo mais alto de todos, não só
  o que mudou.

- **Home redesenhada como dashboard** (`apps/web/src/pages/HomePage.tsx`,
  2026-07-12): layout de menu lateral (`AppSidebar.tsx`) + sessão
  principal, substituindo o placeholder centralizado anterior.
  - **Sidebar**: topo com ícone de perfil (círculo com `UserRound` do
    lucide — **não há upload de foto de perfil ainda**, então o ícone é
    sempre o placeholder, não só um fallback condicional) + nome/sobrenome
    do usuário logado, buscado via `GET /users/me` (endpoint novo, ver
    abaixo). Abaixo, nav com uma única sessão por enquanto ("Eventos", já
    selecionada por padrão via `useState<SidebarSection>("events")`) —
    `AppSidebar` já está estruturado como lista (`NAV_ITEMS`) pra receber
    mais sessões depois sem refatorar. Rodapé com botão "Sair" (era o
    botão de logout do card antigo).
  - **Sessão principal (Eventos)**: busca `GET /events` no mount. Sem
    eventos → só o botão "Criar evento" centralizado na tela (nada mais).
    Com eventos → botão sobe pro canto superior direito (ao lado do
    título "Eventos") e a lista aparece abaixo, cada item com nome, data,
    local e um badge de status (`EventStatusBadge.tsx`).
  - **`CreateEventDialog.tsx`**: formulário simples (não é wizard tipo
    `RegisterDialog`, é um passo só) com nome/data de início/dias de
    competição/local — os mesmos campos do `CreateEventDto` do backend.
    Upload de logo e categorias/equipes ficam pra tela de detalhe do
    evento (ainda não existe, ver "Próximos passos"). Ao criar, o evento
    novo entra no topo da lista local (`setEvents(prev => [event,
    ...prev])`) sem precisar recarregar a lista inteira do servidor.
  - **Removido o `BrandBackdrop`** (fundo animado raio+fotos) da Home —
    decisão de produto tomada durante a implementação, não pedida
    explicitamente: aquele fundo foi desenhado pro momento de impacto do
    login/cadastro, não pra uma tela de trabalho com lista de dados;
    Home agora usa fundo sólido (`bg-background`). Se o usuário preferir
    manter o fundo animado na Home, é fácil reintroduzir.
  - **`GET /events` não filtra por usuário** — retorna todos os eventos
    pra qualquer usuário autenticado (comportamento que já existia antes
    desta tela, não modificado). Não há hoje um conceito de "meus
    eventos" vs "eventos de outros jurados/produtores" — qualquer
    JUDGE/ORGANIZATION vê e (por enquanto) pode gerenciar qualquer evento,
    consistente com a decisão de escopo do topo deste arquivo.
  - **Status do evento**: novo enum `EventStatus`
    (`apps/api/src/events/enums/event-status.enum.ts`:
    `created`/`published`/`started`/`completed`) e coluna `status` na
    entidade `Event`, default `created` (migration
    `AddStatusToEvents1783909162210`, cria o `enum` do Postgres +
    coluna). **Não existe ainda** nenhum endpoint pra transicionar o
    status — todo evento criado fica `created` pra sempre até essa parte
    ser construída (próximo passo).
  - **`GET /users/me` (novo, `users/controllers/users.controller.ts`)**:
    só `JwtAuthGuard` (sem `@Roles`, qualquer usuário autenticado pode
    buscar o próprio perfil), retorna `id`/`role`/`firstName`/`lastName`/
    `email` do usuário do token. Não existia nenhum controller em
    `users/` até agora (só `UsersService`, usado internamente por
    `auth/`) — `UsersModule` ganhou `controllers: [UsersController]`.
    Necessário porque o JWT só carrega `userId`+`role` (ver
    `JwtStrategy`), sem nome — a Home precisa do nome pra sidebar.
  - **Frontend: `apps/web/src/api/client.ts` ganhou autenticação de
    verdade.** Até aqui nenhuma chamada da API mandava o header
    `Authorization` (só auth/cadastro, que não precisa). Novo helper
    `authRequest()` (em cima do `request()` existente) injeta `Bearer
    <token>` lendo `useAuthStore.getState().accessToken` — usado por
    `usersApi.me()` e `eventsApi.list()/create()`. Chamadas de
    `authApi` (login/registro) continuam usando `request()` puro.
  - Componente `Badge` do shadcn adicionado (`npx shadcn@latest add
    badge`) — não existia no projeto antes, usado só no
    `EventStatusBadge`.

- **Eventos: membership N x N + versionamento (2026-07-12).** Mudança
  de arquitetura grande, decidida com o usuário via perguntas de
  esclarecimento antes de implementar (ver respostas abaixo) —
  substitui o modelo anterior de "todo JUDGE/ORGANIZATION vê qualquer
  evento".
  - **`EventMember`** (`events/entities/event-member.entity.ts`,
    tabela `event_members`): relação N x N entre `User` e evento, com
    papel por evento via `EventMemberRole`
    (`admin`/`judge`/`participant`/`spectator` —
    `events/enums/event-member-role.enum.ts`). Vinculado pelo
    `aliasId` do evento (não pelo `id` de uma versão específica — ver
    versionamento abaixo), único por `(aliasId, userId)` (um usuário
    só tem um papel por evento). Quem cria um evento vira `admin` dele
    automaticamente, na mesma transação da criação
    (`EventsService.createEvent`).
  - **Visibilidade totalmente baseada em membership (decisão do
    usuário, substitui o comportamento antigo):** `admin`/`judge`
    enxergam o evento em qualquer status; `participant`/`spectator` só
    quando `published`/`started`/`completed`. Sem membership → sem
    acesso, nem pra listar nem pra buscar por id (`GET /events` e
    `GET /events/:id` viraram `findAllForUser`/`findOneForUser`,
    ambos recebem `userId` do JWT). **Ainda não existe endpoint pra
    adicionar participante/espectador a um evento** (decisão
    explícita do usuário — só o schema e a regra de visibilidade
    nesta rodada; convite/vínculo de membros fica pra quando a
    jornada de atleta/equipe for construída). Na prática, hoje só
    existem memberships `admin` (via criação de evento) — dá pra
    testar `judge`/`participant`/`spectator` inserindo direto no
    Postgres.
  - **Versionamento (`aliasId`/`version`/`active` em `Event`):** o
    `id` de uma linha é específico daquela versão; `aliasId` é a
    identidade lógica estável do evento através das versões — é por
    ele que `EventMember` vincula usuários, não pelo `id` (pedido
    explícito do usuário: "os usuários são vinculados ao evento
    através do aliasId"). Regra implementada, com base na descrição
    do usuário mas com duas decisões de design minhas pra resolver
    ambiguidade (documentadas aqui pra não precisar re-explicar):
    - **Editar (`PATCH /events/:id`)** aplica as mudanças **na mesma
      linha** (mesmo `id`/`version`/`aliasId`) — não versiona ainda.
      Se o status era `published`, a edição reverte pra `created`
      automaticamente (pedido explícito do usuário). Editar um evento
      `started`/`completed` é bloqueado (`409`) — decisão minha, não
      pedida explicitamente: mexer no conteúdo de uma competição já
      em andamento/encerrada parecia arriscado demais pra permitir
      sem uma regra clara, então preferi bloquear a inventar uma.
    - **Publicar (`POST /events/:id/publish`)** é o que efetivamente
      versiona: só funciona a partir de `status=created`; desativa a
      linha atual (`active=false`, mas ela continua no banco pra
      histórico/auditoria — nunca é deletada) e insere uma linha nova
      com o mesmo `aliasId`, `version + 1`, `status=published`,
      `active=true`. Isso vale tanto pra primeira publicação (evento
      nasce `version=1` em `created`, primeira publicação já vira
      `version=2`) quanto pra republicação depois de uma edição — é a
      mesma regra sem caso especial, decisão minha pra manter
      previsível (a descrição do usuário dava a entender que só a
      "nova publicação" versiona, o que essa regra única já cobre
      sem precisar distinguir "primeira" de "seguinte").
    - Só uma linha por `aliasId` pode ter `active=true` por vez —
      garantido por índice único parcial no Postgres
      (`IDX_events_alias_id_active`), não só por lógica de aplicação.
    - **Bug real pego e corrigido durante o teste manual (curl):**
      tentar editar/publicar usando o `id` de uma versão **antiga**
      (já `active=false`) não era bloqueado — `publishEvent` tentava
      inserir outra linha `active=true` pro mesmo `aliasId` e batia
      no índice único, estourando um `500` genérico em vez de um erro
      claro. Corrigido em `getOwnEventOrThrow` (usado por
      `updateEvent`/`publishEvent`): agora rejeita com `409` explícito
      se `!event.active` antes de qualquer outra coisa. `GET
      /events/:id` continua permitindo ver uma versão antiga (é
      histórico/auditoria, faz sentido deixar ver) — só editar/publicar
      em cima dela que não faz sentido.
  - **Rotas HTTP continuam endereçadas pelo `id` da linha, não pelo
    `aliasId`** — decisão consciente de escopo mínimo: mudar pra
    endereçamento por `aliasId` estável exigiria também mexer em
    `categories`/`teams` (que hoje resolvem o evento pai via
    `EventsService.findEventOrThrow(id)`, sem membership/versionamento
    nenhum, propositalmente não tocados nesta rodada). Consequência:
    um link direto pra um evento (`/events/:id`) fica "preso" a uma
    versão específica — depois de uma republicação, o `id` antigo
    ainda existe (é a versão anterior, agora inativa) mas não é mais
    "o evento atual". Isso é uma lacuna conhecida, não resolvida
    ainda — ver "Próximos passos".
  - Migration `AddEventVersioningAndMembers1783910423695`: adiciona
    `alias_id`/`version`/`active` em `events` (com backfill —
    eventos já existentes viram `version=1` do próprio `aliasId`, que
    é igual ao `id` deles) e cria a tabela `event_members` (com
    backfill: quem criou cada evento existente vira `admin` dele).

- **Ajustes visuais na Home (2026-07-12, pedidos avulsos do usuário):**
  - Logo do easyJudge (`logo.png`) no rodapé da sidebar, na mesma
    linha horizontal do botão "Sair" (`justify-between`) — não
    reconstruir como ícone+texto (mesmo erro já cometido antes no
    card de login, ver gotcha mais abaixo "entendeu errado a questão
    da logo").
  - `--background` (light mode, `index.css`) mudou de `#fdfdfb`
    (quase branco) pra `#eaf3fb` (azul bem claro) — só o fundo da
    página; `--card`/`--popover`/sidebar continuam brancos pra manter
    contraste com o conteúdo. Dark mode não foi tocado (já é
    azul-marinho, já lia como "azul").
  - **`DatePicker` novo** (`components/DatePicker.tsx`, Popover +
    Calendar do shadcn — `npx shadcn add calendar popover`, trouxe
    `react-day-picker` + `date-fns` como dependências novas)
    substituindo `<Input type="date">` no `CreateEventDialog`. Motivo:
    o calendário nativo de `<input type="date">` é renderizado pelo
    SO/navegador, não dá pra estilizar de verdade — o usuário pediu
    "um estilo mais bonito" tanto pro ícone quanto pro calendário que
    abre, o que só é possível com um componente próprio. Formata em
    pt-BR (`date-fns/locale`), guarda o valor como string ISO
    (`yyyy-MM-dd`) igual ao `Input` antigo fazia, então o resto do
    form não precisou mudar. **Validação:** como não é mais um
    `<input>` nativo, o `required` do HTML parou de bloquear o
    submit — adicionei uma checagem manual em `handleSubmit`
    (`if (!form.startDate) ...`).
  - **Animação da lista de eventos** (Framer Motion, já era
    dependência): `AnimatePresence` + `motion.div` com `variants`
    propagadas por contexto (pai define `initial="hidden"
    animate="show"` como strings, sem `variants` própria; filhos
    (`listVariants` no grid, `listItemVariants` em cada
    `EventListItem`) resolvem esses nomes via herança — dá pra ter um
    `<div>` comum no meio da árvore que não quebra a propagação).
    `staggerChildren: 0.06` no container faz os itens entrarem em
    cascata. Direção pedida pelo usuário explicitamente: cada item
    desliza de `x: -24` pra `x: 0` (esquerda pra direita), não de
    baixo pra cima (primeira versão usava `y`, corrigida a pedido).
    Hover: `whileHover={{ y: -2 }}` + `hover:border-primary/30
    hover:shadow-md` no item.
  - **`EventThumbnail`** (`components/EventThumbnail.tsx`): mostra
    `event.logoUrl` se existir, senão as iniciais do nome do evento
    (função `getEventInitials`, até 3 letras, ignorando preposições
    comuns em português — `de/da/do/e/em/a/o/...` — pra "Copa Brasília
    de Cheerleading" virar "CBC" e não "CBDC"). Usado tanto na lista
    (`EventListItem`) quanto no preview do `CreateEventDialog`.
  - **Upload de foto no `CreateEventDialog` (opcional):** o dialog
    cria o evento primeiro (`POST /events`, JSON) e, se uma foto foi
    escolhida, faz uma segunda chamada (`POST /events/:id/logo`,
    multipart) — reaproveita o endpoint de logo que já existia desde
    antes da Home (nunca tinha sido usado pelo frontend até agora).
    **`eventsApi.uploadLogo` não usa `authRequest()`/`request()`** —
    esses forçam `Content-Type: application/json` no header, o que
    quebraria o boundary multipart do `FormData` (o navegador precisa
    montar esse header sozinho). Novo helper `authUpload()` em
    `client.ts`, sem `Content-Type` manual.
  - **`vite.config.ts` ganhou um segundo proxy, `/uploads`** →
    `localhost:3000` (mesmo raciocínio do proxy `/api` já existente).
    Sem isso, `<img src={event.logoUrl}>` (ex: `/uploads/logos/xxx.png`)
    resolvia contra o dev server do Vite (5173), que não serve esse
    caminho — só a API (3000) serve `/uploads` (`main.ts`,
    `useStaticAssets`). Pego durante a implementação, antes de gerar
    imagem quebrada em produção... digo, em dev.
  - **Logo do rodapé da sidebar trocada de `logo.png` pro
    `favicon.png`** (2026-07-12, correção do usuário — "a logo do
    footer ficou ruim, usa o favicon mesmo"): `logo.png` (lockup
    largo) não cabia bem numa área compacta ao lado do botão "Sair";
    `favicon.png` é quadrado (512×512), renderizado como ícone pequeno
    (`size-6`) em vez de `h-6 w-auto`.

- **Editar/iniciar/excluir evento na Home (2026-07-13):** três ações
  novas na lista de eventos, todas admin-only (checadas no backend via
  `EventMember.role === 'admin'`, não só escondidas na UI).
  - **Editar** (ícone de lápis ao lado do status/badge, só visível pra
    quem `currentUserRole === 'admin'`): abre `EditEventDialog.tsx`
    (pré-preenchido, reaproveita `EventFormFields.tsx` — extraído do
    `CreateEventDialog` pra não duplicar nome/data/dias/local entre os
    dois formulários) e chama `PATCH /events/:id` (já existia desde o
    versionamento). Sem campo de foto no edit (o `UpdateEventDto` do
    backend não cobre `logoUrl` — trocar a foto de um evento existente
    continua sem UI, só o endpoint de upload isolado).
  - **Iniciar evento** (`POST /events/:id/start`, novo — transição
    `published` → `started`, in-place, não versiona): o CTA
    ("● Iniciar evento", bolinha verde com `animate-ping` do
    Tailwind) só aparece quando `currentUserRole === 'admin'` **e**
    `status === 'published'` **e** hoje cai dentro do intervalo
    `[startDate, startDate + competitionDays - 1]` (calculado com
    `date-fns`, `EventStatusArea.tsx`). Fora desse intervalo ou pra
    quem não é admin, aparece o badge de status normal. Depois de
    iniciado (`status === 'started'`), todo mundo que enxerga o evento
    vê "● Ao vivo" (bolinha vermelha piscando) no lugar do badge — não
    é mais uma ação, só indicador, e não é admin-only (status é
    informação pública dentro de quem já tem membership).
  - **Excluir evento** (`DELETE /events/:id`, novo, `204`): ícone de
    lixeira ao lado do lápis, abre `ConfirmDialog.tsx` (componente
    genérico novo, reutilizável pra qualquer confirmação
    destrutiva — título/descrição/label customizáveis). **Exclui TODAS
    as versões do evento** (todas as linhas com aquele `aliasId`, não
    só a ativa) mais todos os `EventMember` — decisão de que "excluir
    o evento" apaga o histórico inteiro, não só a versão vigente.
    `categories`/`teams` de cada versão saem junto via `ON DELETE
    CASCADE` (FK que já existia, não precisou de nada novo). **Sem
    endpoint de undo/soft-delete** — é destrutivo de verdade, dai o
    popup de confirmação.
  - **`currentUserRole` no payload de `Event`:** pra frontend saber
    quais ícones mostrar por evento sem precisar de uma chamada
    separada, `GET /events` e `GET /events/:id`
    (`findAllForUser`/`findOneForUser` em `EventsService`) passaram a
    anexar o papel do próprio usuário logado em cada evento retornado
    (`EventWithRole = Event & { currentUserRole }`). Implementado com
    `getRawAndEntities()` no `findAllForUser` (precisa de
    `addSelect('member.role', 'member_role')` pra trazer a coluna do
    join sem virar uma entidade `EventMember` completa por linha).

- **Módulo `scoring-templates` — sistema de pontuação como biblioteca
  pessoal do usuário (2026-07-13/14).** `ScoringTemplate` (nome,
  descrição, `targetScore`) + `ScoringCriterion` (árvore auto-
  referenciada via `parentId`, tipo `group`/`score_item`, `maxScore`,
  `weight`, `order`, `showInJudgingSheet`, `allowDecimalScoring`,
  `isRequired`) — não pertence a um evento específico, é reutilizável
  entre eventos (associação com `Category` só entrou depois, ver
  abaixo). Rotas `POST/GET/PATCH/DELETE /scoring-templates` e
  `POST/GET/PATCH/DELETE /scoring-templates/:templateId/criteria` +
  `POST .../criteria/:id/move` (drag-and-drop, reordena/reparenta).
  - **Frontend**: `ScoringTemplatesListPage` (grid de cards) +
    `ScoringTemplateBuilderPage` (`/scoring-templates/:id`) — árvore
    editável com painel lateral (`EditCriterionPanel`), drag-and-drop
    (`lib/dndProjection.ts` calcula onde soltar/reparentar antes de
    confirmar no servidor), `ScoringValidationBar` (mostra se a soma
    dos critérios-raiz bate com a meta).
  - **`distributedScore` (2026-07-14)**: campo computado (não é
    coluna) em `ScoringTemplate`, soma do `maxScore` dos critérios
    **raiz** (`parentId IS NULL`) de cada template — calculado numa
    query agrupada separada em `findAllForUser` (não dá pra usar
    `loadRelationCountAndMap`, que só serve pra `COUNT`, não `SUM`).
    Um template está **"completo"** quando `distributedScore ===
    targetScore` — badge `ScoringTemplateStatusBadge` ("Completo"/
    "Incompleto") na listagem, e essa é a condição usada em toda
    validação de "template utilizável" no resto do sistema (ver
    `assertUsableTemplate` abaixo).
  - **Clonagem ao criar (2026-07-14)**: `CreateScoringTemplateDto`
    aceita `cloneFromId?` opcional — `ScoringTemplatesService.create`
    valida que o template de origem pertence ao usuário e clona a
    árvore inteira de critérios pro novo template
    (`cloneCriteria`, privado). **Gotcha resolvido**: não dá pra só
    trocar `templateId` nos critérios copiados — cada nó precisa de um
    `id` próprio, e `parentId` dos filhos precisa apontar pro **novo**
    id do pai clonado, não pro antigo. Resolvido com um `Map<oldId,
    newId>` e processamento em ordem topológica simples (só clona um
    nó depois que o pai dele já foi clonado ou se for raiz — while
    loop com `findIndex` até esvaziar a lista). No frontend, o dialog
    de criar template busca a lista de templates do usuário ao abrir
    e, ao escolher um "Clonar de", pré-preenche nome (`"Nome
    (cópia)"`) e meta de pontos a partir da origem (editável antes de
    salvar).

- **Módulo `regulations` — documentos + deduções de um evento
  (2026-07-14).** `Regulation` é 1:1 com `Event` (endereçado sempre por
  `eventId`, nunca pelo próprio `id` — o front nem recebe esse `id` na
  resposta). Segue o mesmo padrão de domínio filho que `categories`/
  `teams` (importa `EventsModule`, injeta
  `EventsService.findEventOrThrow`).
  - **Sem linha persistida até o primeiro write**: `GET
    /events/:eventId/regulation` não cria nada no banco só por ser
    acessado — se não existir `Regulation` pro evento, devolve uma
    view sintética (modo `iasf`, `documents: []`, deduções nos valores
    padrão). A linha real (`getOrCreateForEvent`, privado) só nasce no
    primeiro `PATCH` de deduções ou upload de documento. Decisão
    deliberada pra não poluir o banco com registros vazios de eventos
    que ninguém nunca configurou.
  - **Documentos** (`RegulationDocument`, N por `Regulation`): 2 slots
    fixos obrigatórios (`official_regulation`, `safety_rules`) + 1
    opcional (`code_of_conduct` — **removido da UI** a pedido do
    usuário em 2026-07-14, o `enum` `RegulationDocumentKind` ainda tem
    o valor mas nada mais cria documentos desse `kind`) + `additional`
    (lista livre, múltiplos). Reenviar um documento de slot fixo
    **substitui** o anterior (delete+insert, mesmo raciocínio de "só
    uma linha ativa" já usado em outros lugares do projeto — não limpa
    o arquivo antigo do disco, mesma escolha já feita em
    `setEventLogo`). Upload aceita PDF/JPEG/PNG, máx. 10MB
    (`common/config/document-upload.config.ts`, mesmo formato de
    `logo-upload.config.ts`, salva em `uploads/regulation-documents/`).
    Documentos adicionais pedem um **título** ao usuário antes do
    upload (dialog com `Input` pré-preenchido com o nome do arquivo,
    editável) — os 2 slots fixos não, o nome de exibição é sempre o
    nome original do arquivo.
  - **Deduções**: `deductionMode` (`iasf` | `custom`) + `deductionValues`
    (jsonb, `Partial<Record<DeductionType, number>>`, só guarda
    overrides quando `custom`). Os 9 tipos de dedução reais (não são
    mais os 6 de exemplo do mockup original) e seus valores padrão:
    `athlete_fall` -1.0, `major_athlete_fall` -2.0, `building_bobble`
    -2.0, `building_fall` -3.0, `major_building_fall` -4.0,
    `legality_infractions` -4.0, `skill_out_of_level` -1.0,
    `time_limit_violations` -1.0, `boundary_violations` -1.0
    (`constants/iasf-deductions.ts`, ordem fixa de exibição via
    `DEDUCTION_TYPES_ORDER`, não depende de ordem de chaves de objeto).
    Rótulos em inglês (termos oficiais de regulamento de cheer) ficam
    só no frontend (`lib/deductionLabels.ts`), backend manda só
    `{type, defaultValue, value}` — mesmo padrão de `ROLE_LABELS`
    (rótulo é responsabilidade do front, não do back). Tabela editável
    só quando `mode === 'custom'`; virar pra IASF mostra os defaults
    read-only. Salva com debounce por linha (mesmo padrão de
    `persistTargetScore` no builder de templates).
  - **Frontend**: `RegulationPage` (`/events/:id/regulation`), 3
    seções (Documentos, Deduções, Sistemas de pontuação — a terceira
    reaproveita `ScoringTemplateCard`/`CreateScoringTemplateDialog` já
    existentes, sem duplicar UI) + rodapé "Próxima etapa" com o mesmo
    visual do banner âmbar já usado em `SetupRecommendedBanner`.

- **Categorias agora exigem um sistema de pontuação "completo"
  (2026-07-14).** `Category.scoringTemplateId` (FK nullable no banco —
  categorias antigas não têm — mas **obrigatório** em
  `CreateCategoryDto`). `ScoringTemplatesService.assertUsableTemplate`
  (chamado por `CategoriesService.create`/`update`) valida que o
  template pertence ao usuário **e** está "completo" (`distributedScore
  === targetScore`), senão `409`. Consequência direta: como a FK passou
  a existir de verdade, **excluir um template em uso por categorias
  agora é bloqueado** (`409`, contagem via `categoriesRepo.count` — só
  possível porque `ScoringTemplatesModule` registra
  `TypeOrmModule.forFeature([...,Category])` pra ter o repositório,
  sem precisar importar `CategoriesModule` inteiro e criar dependência
  circular). `findAllForEvent` inclui `relations: ['scoringTemplate']`
  pra listagem mostrar o nome. **Gotcha real pego depois do primeiro
  teste manual**: `create`/`update` retornavam a entidade de
  `categoriesRepo.save()`, que **não hidrata relações** — só a coluna
  `scoringTemplateId`, então a tela mostrava "—" na coluna até um
  refresh manual. Corrigido buscando a categoria de novo com
  `relations: ['scoringTemplate']` (`findCategoryWithTemplate`) antes
  de retornar do `create`/`update`.
  - **Tempo de apresentação** (`Category.presentationTimeSeconds`,
    nullable no banco / obrigatório no DTO): default calculado no
    frontend por `categoryFormat`+`modality`
    (`lib/presentationTime.ts`) — Team Cheer All Star: 2:30; Team
    Cheer Escolar/Universitário: 2:45; qualquer outro formato: 1:00.
    Recalculado sempre que formato ou modalidade mudam no formulário
    (mesmo padrão de auto-override já usado pra `nonTumbling`), editável
    pelo usuário antes de salvar. Alimenta o cronograma do evento numa
    etapa futura (ver "Próximos passos").
  - Extraído `ScoringTemplateCard.tsx` de dentro de
    `ScoringTemplatesListPage.tsx` pra reusar também em
    `ScoringTemplatesSummarySection` (regulamento) — evita duas versões
    divergentes do mesmo card.

- **Módulo `programs` — "Programas e Equipes", perfil canônico +
  catálogo do produtor (2026-07-14/15).** Etapa "Programas e equipes"
  do setup do evento: `Program` (renomeado depois pra
  `ProgramParticipation`, ver abaixo) é a instituição/academia
  participante de um evento — nome, email, cidade, estado, logo
  opcional. `Team` é um domínio separado, aninhado (equipe dentro de
  um programa, só nome, ligada N:N a `Category` via `@JoinTable`
  nativa do TypeORM, sem entidade de junção própria).
  - **Perfil canônico + catálogo do produtor.** Cada linha de
    `ProgramParticipation` é "esse programa nesse evento", não o
    programa em si — tem `createdById` (o produtor que cadastrou) e um
    `userId` opcional (preenchido quando o programa cria conta própria,
    role `PROGRAM`). Enquanto `userId` é nulo, os dados
    (`name`/`email`/`city`/`state`/`logoUrl`) são a própria fonte de
    verdade daquela linha; quando um usuário `PROGRAM` se cadastra com o
    mesmo email, `ProgramsService.linkUnclaimedProgramsByEmail`
    (chamado por `AuthService.setPassword`) vincula automaticamente
    **todas** as linhas não reclamadas daquele email, em qualquer
    evento, e cria um `ProgramProfile` (entidade canônica, 1:1 com o
    `User`) semeado com os dados do cadastro. A partir daí, os dados
    locais da linha viram um snapshot congelado — toda leitura passa
    pelo `ProgramProfile` via join (`ProgramsService.toProgramView`), e
    editar via `PATCH /programs/me` (`ProgramProfileController`, só o
    próprio usuário `PROGRAM`) atualiza **uma linha só**, refletindo
    pra todos os produtores que cadastraram aquele programa em
    qualquer evento — sem precisar propagar `UPDATE` em N linhas (isso
    foi uma correção de arquitetura: a primeira versão fazia `UPDATE`
    em massa direto nas linhas `Program`, o que vazava dado entre
    eventos de produtores diferentes quando dois produtores cadastravam
    o mesmo programa manualmente com dados divergentes).
  - **`GET /programs/catalog`** (`ProgramCatalogController`,
    `ProgramsService.findCatalogForUser`): pra evitar redigitar o mesmo
    programa em cada evento novo, a lista de escolha do produtor é
    **todo usuário `PROGRAM` da plataforma** (com o `ProgramProfile`
    resolvido pra exibição + um flag `usedByMe`) **mais** as linhas do
    catálogo do próprio produtor (`createdById` dele) que ainda **não**
    têm `userId` (as que já têm conta não precisam aparecer duas vezes
    — já estão no primeiro grupo). Escolher uma entrada `platform`
    vincula de verdade (`userId` no payload); escolher uma entrada
    `own` só copia os dados pro formulário, sem vínculo.
  - **Sem duplicidade no catálogo**: `ProgramsService.
    assertNoDuplicateInCatalog` rejeita (`409`) cadastrar/editar um
    programa com nome OU email já usado por outra linha do catálogo
    daquele produtor, **exceto** quando é um match exato de nome e
    email (aí é reaproveitamento legítimo do mesmo programa em outro
    evento, não duplicidade).
  - **Rename `Program` → `ProgramParticipation` (2026-07-15):**
    ter `Program` e `ProgramProfile` lado a lado ficou ambíguo — não
    fica óbvio só pelo nome que um é "uma linha por evento" e o outro é
    "o dado canônico único". Renomeada a entidade (classe, arquivo,
    DTOs, nome da tabela — `programs` → `program_participations`, com
    migration renomeando as constraints/índices, mesmo padrão do rename
    anterior `teams`→`programs`). **Só o nome do tipo mudou** —
    `ProgramsService`/`ProgramsController`/`ProgramsModule`, a pasta
    `programs/`, os nomes de método e todas as rotas HTTP continuam
    iguais (é o domínio/rota pública, não a entidade). Frontend não
    mudou (o tipo `Program` do `client.ts` não expõe `ProgramProfile`,
    não tinha a mesma ambiguidade).
  - Sem integração com `EventMember`: vincular `userId` numa
    `ProgramParticipation` não dá acesso/membership ao evento pro
    usuário — isso é um endpoint futuro separado (ver "Próximos
    passos").

- **Módulo `judges` — mesmo padrão de catálogo aplicado a jurados,
  só backend (2026-07-15).** A pedido do usuário, o mesmo padrão de
  `programs` (perfil canônico + catálogo do produtor + dedup +
  merge automático) foi replicado pra jurados: `JudgeParticipation`
  (`id`, `eventId`, `createdById`, `userId` opcional, `name`, `email`
  — sem `city`/`state`/`logoUrl`, não fazem sentido pra jurado) +
  `JudgeProfile` (canônico, 1:1 com `User` role `JUDGE`). Endpoints
  espelham 1:1 os de `programs`: `POST/GET/PATCH/DELETE
  /events/:eventId/judges`, `GET /judges/catalog`, `GET/PATCH
  /judges/me`. `AuthService.setPassword` chama
  `JudgesService.linkUnclaimedJudgesByEmail` quando `role === JUDGE`,
  mesmo hook usado pra `PROGRAM`. Domínio próprio
  (`apps/api/src/judges/`), sem abstração compartilhada com
  `programs/` (mesma convenção do projeto — cada domínio é
  autocontido; duplicar a mesma estrutura 1x não justificou extrair
  uma base genérica). Na época desta seção (2026-07-15) ainda não
  existia tela — a tela de escala de arbitragem ("Painel de jurados")
  foi construída depois, junto do módulo `judging`, ver seção "Módulo
  `judging`" mais abaixo.

- **Setup do evento ganhou 2 etapas placeholder + tag "recomendado"
  dinâmica (2026-07-14).** `EventSetupPage` tinha 3 etapas
  (`regulation`/`categories`/`teams`); "Regulamento" saiu de
  placeholder pra tela real nesta sessão (ver módulo `regulations`
  acima). Adicionadas 2 etapas novas, ainda sem tela construída
  (mesmo padrão que "Regulamento" usava antes: `completed: false`
  fixo, sem `href`, botão desabilitado "Disponível em breve"):
  `judgePanel` ("Painel de jurados" — jurados do evento + o que cada
  um julga em cada sistema de pontuação) e `schedule` ("Cronograma" —
  ordem de apresentação das equipes, vai consumir
  `presentationTimeSeconds` de cada categoria). `buildSetupSteps` e
  o header ("Prepare X em N etapas") já eram genéricos o suficiente
  pra crescer sem mudança de lógica, só `steps.length`.
  **Tag "RECOMENDADO"**: antes fixa em `index === 0`; agora acompanha
  `firstIncomplete` (primeira etapa não concluída), calculado uma vez
  e reusado tanto pro banner quanto pro card. **Atualização
  (2026-07-18):** os dois placeholders viraram telas reais —
  `judgePanel` aponta pra `/events/:id/judging` (`JudgingPage`, ver
  módulo `judging` abaixo) e `schedule` pra `/events/:id/schedule`
  (`SchedulePage`, ver módulo `schedule` abaixo). Na lista de
  `buildSetupSteps` (`apps/web/src/lib/eventSetupSteps.ts`), a ordem
  ficou `regulation` → `categories` → `programs` → `schedule` →
  `judgePanel` (cronograma antes do painel de jurados, pedido
  explícito do usuário — a ordem do array é o que define tanto o
  número do card quanto a etapa "recomendada").
- **Terminologia "template" → "sistema de pontuação" (2026-07-14):**
  a pedido do usuário, referências a "template(s) de pontuação" na UI
  viraram "sistema(s) de pontuação" (heading da seção 3 do
  regulamento, textos informativos, link "Ir para Sistemas de
  Pontuação"). Nomes de arquivo/tipos internos (`ScoringTemplate`,
  `scoring-templates/`) **não** foram renomeados — é só rótulo de UI.
  Card "Competidores" no setup também renomeado pra "Programas e
  equipes".
- **Gotcha do shell com sidebar: `min-h-svh` no wrapper quebra o
  scroll interno (2026-07-14).** Todas as páginas com `AppSidebar`
  usavam `<div className="flex min-h-svh ...">` (altura **mínima**,
  cresce com o conteúdo) enquanto o `<aside>` da sidebar é fixo em
  `h-svh` (altura da viewport). Com conteúdo mais alto que uma tela
  (ex: a nova `RegulationPage`), o wrapper crescia além da altura da
  sidebar, que ficava "curta" visualmente conforme rolava a página. O
  `overflow-y-auto` do `<main>` só funciona de verdade se o pai tiver
  altura **fixa**, não mínima — trocado `min-h-svh` → `h-svh` no
  wrapper de `HomePage`, `EventSetupPage`, `CategoriesPage`,
  `RegulationPage`, `ScoringTemplatesListPage` e
  `ScoringTemplateBuilderPage` (não em `LoginPage`, que não tem
  sidebar e usa `min-h-svh` de propósito pra centralizar o card com
  espaço pra crescer).

- **Módulo `schedule` — cronograma/timeline de apresentações
  (2026-07-18).** Etapa "Cronograma" do setup do evento, virou tela de
  verdade. Modela o cronograma **operacional** do evento (quando e
  onde cada equipe se apresenta/aquece, e onde entram intervalos,
  cerimônias e premiações) — não é a escala de jurados (isso é
  `judging`, ver abaixo), mas `judging` referencia os recursos daqui.
  - **Entidades**: `ScheduleDay` (um por `eventId`+`dayIndex`, nasce
    via get-or-create — `date`, janela `startMinutes`/`endMinutes`,
    `defaultWarmupMinutes`, `ignoreUnscheduledPresentations`) →
    `ScheduleResource` (linha nomeada livremente pelo organizador
    dentro de um dia, ex. "Tapete Azul" — `color`,
    `supportsPresentations` controla se aceita apresentação,
    `pairedResourceId` liga um recurso de aquecimento à pista que ele
    atende) → `ScheduleEntry` (o card da timeline —
    `type`: `presentation`/`warmup`/`break`/`ceremony`/`award`,
    `order`, `durationMinutes`, `teamId`/`categoryId` quando aplicável,
    `linkedEntryId` agrupa apresentação+aquecimento+intervalos
    automáticos de espera gerados junto).
  - **Horário nunca é persistido** — sempre `order` × `durationMinutes`
    calculado no cliente (`lib/scheduleTime.ts`). Criar/mover/remover
    uma entry dispara reconciliação (`reconcileWarmupDelays`/
    `reconcileMatGaps`, loops de convergência com limite de
    passes — não é ponto fixo garantido em todos os casos extremos,
    ex. 3+ apresentações intercaladas da mesma equipe).
  - **Endpoints** (`/events/:eventId/schedule`): CRUD de
    `days`/`resources`/`entries` (+ `move` pra reordenar), `GET
    days/:dayId/unscheduled` (pares equipe/categoria pendentes
    naquele dia — "já agendado" é validado **por dia**, não por
    evento inteiro, já que cada equipe precisa se apresentar em cada
    dia do evento), `POST days/:dayId/auto-generate` (gera cronograma
    automático, **destrutivo**: apaga todas as entries do dia antes)
    e `POST days/:dayId/replicate` (copia o dia inteiro pros demais
    dias, **destrutivo no destino**).
  - **Frontend (`SchedulePage`)**: timeline drag-and-drop (`@dnd-kit`,
    visão linha do tempo ou tabela) — arrastar equipe não agendada pra
    um recurso cria apresentação+aquecimento automaticamente; arrastar
    componentes da biblioteca (Almoço, Abertura, Premiação,
    Contestação, custom); editar/criar recursos; configurar
    horário/tempo de aquecimento padrão do dia; "repetir em todos os
    dias"; gerar automaticamente; detecção visual de conflitos
    (`lib/scheduleConflicts.ts`) e aviso de estouro de horário do dia.
  - Migrations em sequência mostram evolução em fase de POC:
    `CreateSchedule` → `GenericScheduleResources` →
    `AddColorToScheduleResources` → `FlipMatWarmupPairingDirection`
    (inverteu a direção do vínculo aquecimento→pista) →
    `AddIgnoreUnscheduledPresentationsToScheduleDays`. `dayIndex`
    nunca é renumerado ao excluir um dia (buracos na sequência são
    inofensivos).

- **Módulo `judging` — escala de arbitragem, complementar a `judges`
  (2026-07-15, atualizado 2026-07-18).** `judges/`
  (`JudgeParticipation`/`JudgeProfile`) é o **catálogo de pessoas**
  (quem é jurado neste evento); `judging/` é a **escala** — quem julga
  o quê, em qual pista. Referencia `JudgeParticipation` existentes, não
  cria jurados. Não guarda nota nenhuma (não existe módulo de
  lançamento de notas ainda) — só monta o painel de arbitragem.
  - **Entidades**: `CriterionJudgeAssignment` (liga um
    `ScoringCriterion` **folha**, tipo `score_item`, +
    `ScheduleResource` + `JudgeParticipation`; único por
    critério+recurso+jurado) e `SpecialRoleAssignment` (liga `eventId`
    + `role` — enum `SpecialJudgeRole`: `legality_judge`/`head_judge`
    — + `ScheduleResource` + `JudgeParticipation`; guarda `eventId`
    porque função especial não pertence a um template de pontuação).
    Ambas assumem que um jurado não pode estar em duas pistas ao mesmo
    tempo, por isso a atribuição é sempre por `ScheduleResource` (o
    dia fica implícito via recurso). A migration
    `AddResourceToCriterionJudgeAssignments`/
    `AddResourceToSpecialRoleAssignments` (2026-07-18) trocou o
    vínculo antigo por `schedule_day_id` pra `resource_id` — **fez
    `DELETE FROM` nas tabelas antes**, aceitável só por ainda ser fase
    de POC sem dado real em produção.
  - **Endpoints** (`/events/:eventId/judging`): `GET /` (`?templateId=`,
    retorna dias/recursos relevantes + atribuições da árvore de
    critérios), `PUT
    .../criteria/:criterionId/resources/:resourceId/judges` (substitui
    o conjunto de jurados de uma folha), `POST .../bulk-assign`
    (atribui um jurado a todas as folhas descendentes de um grupo,
    estratégia `unassigned_only`/`replace`/`add`), `GET
    resources/:resourceId/special-roles` / `PUT
    resources/:resourceId/special-roles/:role`.
  - **Frontend (`JudgingPage`, "Painel de jurados")**: escolhe sistema
    de pontuação (só os já usados por categoria com apresentação
    agendada) e dia; mostra progresso geral e do dia; drag-and-drop
    (`@dnd-kit`) de um jurado do painel lateral pra uma célula
    critério×pista (soltar num grupo abre diálogo de conflito com
    estratégia de merge); sheet de checkboxes ao clicar numa célula;
    card de "Funções especiais" (tabela função×recurso); cria jurado
    inline via `CreateJudgeDialog`.
  - Um template só é "usável" no painel se alguma `Category` do evento
    o referencia **e** tem apresentação agendada no cronograma —
    acopla `judging` a `schedule` além de `scoring-templates`.

- **Gerenciamento de acessos do evento (`event-staff`, 2026-07-19).**
  Refatoração do `EventMember` (ver "Atualização 2026-07-19" no topo
  deste arquivo) + tela nova pra gerenciar quem tem acesso a um evento
  e com qual papel — antes só quem criava o evento tinha
  membership/acesso; agora o admin pode convidar mais gente.
  - **`EventMember` por pessoa, não por papel**: `roles:
    EventMemberRole[]` (array — dá pra acumular ex. ADMIN+ASSESSOR);
    `userId` nullable (convite por nome+email antes de existir conta —
    mesmo padrão de `JudgeParticipation`/`ProgramParticipation`);
    `firstName`/`lastName`/`email` viram o snapshot de exibição
    enquanto pendente. `PARTICIPANT` renomeado pra **ASSESSOR** (papel
    de quem ajuda a configurar o evento — edita, mas não mexe em
    acessos/pessoas).
  - **Auto-claim por email**: `EventsService.linkUnclaimedMembersByEmail`
    é chamado em `AuthService.setPassword` — ao completar o cadastro,
    reclama incondicionalmente qualquer `EventMember` pendente
    (`userId` null) com aquele email. Roda **antes** de
    `JudgesService.linkUnclaimedJudgesByEmail` de propósito: este
    último busca a linha do roster pelo `userId` já vinculado — se a
    ordem fosse invertida, criaria linha duplicada. Também há
    sincronia automática nos dois sentidos: criar/remover uma
    `JudgeParticipation` faz `upsertMemberRole`/`removeMemberRole` do
    papel JUDGE no roster do evento (sem tela própria pra isso).
  - **`EventMemberGuard` + `@EventRoles`** (`events/guards/`,
    `events/decorators/`): espelham `RolesGuard`/`@Roles`, mas checam
    `EventMember.roles` (papel *dentro do evento*, via `:eventId` da
    rota) em vez do papel global da conta. Substituiu autorização que
    antes ficava espalhada nos services (ex.: `judging.service.ts`
    recebia `userId` e checava ownership do template) — agora os
    controllers de `categories`/`judges`/`judging`/`programs`/
    `regulations`/`schedule`/`teams` usam
    `@UseGuards(JwtAuthGuard, EventMemberGuard)` + `@EventRoles(...)`,
    e os services correspondentes perderam os parâmetros `userId` (há
    métodos "unchecked" novos, ex. `findAllForTemplateUnchecked`).
    Padrão geral: ADMIN+ASSESSOR escrevem, JUDGE só lê onde aplicável
    (`JudgesController` é exceção: ASSESSOR tem CRUD completo do
    catálogo de jurados mesmo sem poder mexer no roster de acessos).
  - **Endpoints**: `GET/POST /events/:eventId/staff` (listar roster /
    adicionar pessoa com `roles[]`), `PATCH
    /events/:eventId/staff/:memberId` (trocar papéis), `DELETE
    /events/:eventId/staff/:memberId`. Mais `GET /events/:eventId/teams`
    (`EventTeamsController`, novo) — todas as equipes do evento
    (qualquer programa), usado pela aba "Visão geral das categorias"
    nova em `ProgramsPage` (`CategoriesOverviewPanel`).
  - **Frontend (`EventStaffPage`, `/events/:id/access`)**: lista o
    roster com badges de papéis, indica dono do evento e convite
    pendente; admin pode adicionar (`CreateEventStaffMemberDialog`),
    editar papéis (`EditEventStaffRolesDialog`) e remover — com
    proteção de que só o próprio dono pode alterar/remover a si mesmo.
    `useEventSetupGuard` (novo, `lib/`) centraliza o redirect de quem
    não é admin/assessor pra Home nas páginas de setup — faz um `GET
    /events/:id` próprio, redundante com o que cada página já busca no
    `useEffect`, ineficiência aceita conscientemente em troca de um
    guard único.
  - **Fluxo de publicação ganhou celebração**: `PublishEventCard`
    (card novo no fim do `EventSetupPage`) dispara `POST
    /events/:id/publish` de verdade só quando todas as etapas do setup
    estão completas; `PublishCelebrationOverlay` reaproveita a
    animação do `BrandBackdrop` (que ganhou props `className`/
    `onDone` pra isso) como overlay por cima da página, revelando
    "Prontos para o show!" — antes não havia nem card dedicado nem
    celebração pra publicar.
  - **Bug de republicação corrigido nesta rodada** (embutido no mesmo
    diff de `events.service.ts`, não é sobre staff): `publishEvent`
    agora "adota" `Category`/`ProgramParticipation`/`ScheduleDay`/
    `Regulation`/`JudgeParticipation`/`SpecialRoleAssignment` pra
    versão nova publicada — antes, republicar um evento editado fazia
    ele aparecer com 0 categorias/programas na versão nova.
  - **Ponta solta**: `JudgesService.create` joga o `dto.name` inteiro
    pra `firstName` do `EventMember` (via `upsertMemberRole`), com
    `lastName` null — inconsistente com `CreateEventStaffMemberDto`,
    que exige nome e sobrenome separados. Vale unificar se isso virar
    fonte de bug visual no roster.

## Próximos passos (não iniciados ainda)

1. **Lançamento de notas em si.** Toda a escala de arbitragem já existe
   (módulo `judging` — quem julga o quê, em qual pista) e o cronograma
   já existe (módulo `schedule`), mas ninguém ainda lança uma nota de
   verdade. Falta modelar `ScoreEvent` (event sourcing, append-only,
   ver "Requisitos não-negociáveis") e `Result` (apuração), e construir
   a tela do jurado que consome as `CriterionJudgeAssignment` dele pra
   saber o que julgar, com optimistic UI + buffer local (IndexedDB) +
   fila de retry.
2. Decidir e implementar mecanismo de tempo real (WebSocket/Socket.io ou
   Supabase Realtime) para o painel do produtor
3. Transição de status `completed` ("concluir evento") — `created` ⇄
   `published` → `started` já existem (`PATCH /events/:id`, `POST
   /events/:id/publish`, `POST /events/:id/start`); falta decidir a
   regra de "concluir" (manual pelo admin? automático quando os
   `competitionDays` terminam?)
4. Endereçamento estável de evento por `aliasId` nas rotas HTTP (hoje
   é por `id` de versão específica — ver gotcha de versionamento
   acima). **Atualização (2026-07-19):** o refactor de endereçar as
   entidades filhas do evento por `aliasId` internamente (não mais por
   `id` de versão) já foi feito — `categories`/`program_participations`/
   `schedule_days`/`regulations`/`judge_participations`/
   `special_role_assignments` agora guardam `alias_id` (sem FK, mesmo
   padrão de `EventMember.aliasId`), e `EventsService.publishEvent`
   não precisa mais "adotar" entidades filhas numa republicação (ver
   seção "Gerenciamento de acessos do evento" mais abaixo pro contexto
   do bug que motivou isso). O que falta de verdade agora é só o
   endereçamento HTTP em si: as rotas continuam usando o `id` de uma
   versão específica (`/events/:eventId/...`), não o `aliasId` —
   trocar isso é mudança maior (afeta como o frontend guarda/navega
   links de evento) e continua fora de escopo por enquanto.
5. Cobertura de testes automatizados: nenhum dos services/guards novos
   (`schedule`, `judging`, `event-staff`, `EventMemberGuard`) tem
   `.spec.ts` ainda — todo o backend segue validado só manualmente
   (curl/navegador), o que já escalou mal o suficiente pra virar risco
   real com esse volume de domínios interdependentes
6. Jornada do atleta/espectador (consulta de nota e resultado) — o
   papel `SPECTATOR` já existe no `EventMemberRole` e `JudgingController`/
   `EventTeamsController` já liberam leitura pra `JUDGE`, mas não há
   nenhuma tela pra esses papéis ainda; todas as páginas de setup
   redirecionam quem não é admin/assessor pra Home
   (`useEventSetupGuard`)

## Gotchas / decisões técnicas já resolvidas (não repetir o troubleshooting)

- **Organização de pastas por domínio, com `controllers/`/`services/`
  próprios dentro de cada um** (decisão de 2026-07-12, ver "Estrutura do
  repositório"). Quando um domínio filho precisa validar algo do
  domínio pai (ex: `categories`/`teams` conferindo que o evento existe),
  o padrão é: o módulo pai exporta o service (`exports: [XyzService]` no
  `.module.ts`) com um método público para essa validação
  (`EventsService.findEventOrThrow`), e o módulo filho importa o módulo
  pai (`imports: [EventsModule]`) e injeta o service — não duplicar a
  query nem acessar o repositório do pai diretamente.
- **TypeORM está na v0.3.x** (`^0.3.20`). CLI roda via
  `typeorm-ts-node-commonjs` (comando padrão dessa versão, já configurado
  em `apps/api/package.json`: `migration:generate`, `migration:run`,
  `migration:revert`).
- Colunas com tipo TS `union | null` (ex: `passwordHash: string | null`)
  **precisam** de `type: 'varchar'` explícito no `@Column()` — o TypeORM
  não infere via reflection nesse caso e a migration falha com
  `DataTypeNotSupportedError`.
- `configService.get<string>(...)` pode retornar `undefined` e quebra
  tipagem em campos que exigem `string` (ex: `secretOrKey` do JWT
  Strategy). Usar `configService.getOrThrow<string>(...)` nesses casos.
- Extensão `uuid-ossp` precisa estar habilitada no Postgres
  (`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`) antes de rodar a
  migration inicial, pois os IDs usam `uuid_generate_v4()`.
- Ambiente de dev roda em Ubuntu 24.04 com Wayland; Docker instalado via
  repositório oficial (não snap), usuário ainda não está no grupo
  `docker` permanentemente (usar `sudo` nos comandos docker ou `newgrp
  docker` até o próximo reboot).
- Payload de `/auth/register` usa `documentType` (`cpf`|`cnpj`) +
  `documentNumber`, não um campo único `document`.
- Tipos usados só na assinatura de um método decorado (ex: `@Req() req:
  AuthenticatedRequest`) precisam de `import type { ... }`, não `import
  { ... }` — o projeto tem `emitDecoratorMetadata` + `isolatedModules`
  ligados, e o import normal quebra a compilação com erro TS1272.
- **`id` de campo de formulário precisa ser único na página inteira,
  não só dentro do componente.** O `RegisterDialog` é renderizado como
  irmão da `LoginPage` (o Dialog é um portal, mas o React não desmonta
  o formulário de login por trás dele) — usar o mesmo `id="email"` nos
  dois quebrou `document.querySelector`/testes e, em teoria, qualquer
  `label htmlFor` que dependa de unicidade. Depois do redesenho pra
  assistente conversacional (2026-07-12), o `RegisterDialog` nem usa
  mais `id` nos campos de texto — cada etapa mostra só um input por
  vez, então `aria-label` sozinho já resolve label+acessibilidade sem
  reabrir esse risco de colisão. Vale esse cuidado em qualquer modal
  renderizado sobre uma página com formulário.
- **`Select` do shadcn (Base UI) não mostra o label do item selecionado
  por padrão — mostra o `value` bruto.** `<SelectValue />` sozinho
  renderizou `"judge"` em vez de "Jurado" na tela. Precisa passar uma
  função como filho: `<SelectValue>{(value) => LABELS[value]}</SelectValue>`
  (ver `RegisterDialog.tsx`, passo `role`). Pego via teste no navegador,
  não apareceria em typecheck/lint.
- `apps/web` usa Tailwind v4 (config-less, via `@import "tailwindcss"`
  em `src/index.css` + plugin `@tailwindcss/vite`) — não existe
  `tailwind.config.js`. O tema (cores, radius) fica em `:root`/`.dark`
  no próprio `index.css`, gerado pelo `shadcn init`.
- TypeScript 6.x depreciou `baseUrl` em `tsconfig` (aviso TS5101) —
  `paths` sozinho já resolve relativo ao tsconfig, não precisa de
  `baseUrl` junto.
- **`Select` do shadcn (Base UI) só mostra o `placeholder` quando o
  `value` controlado é `null`/`undefined` — string vazia `""` conta
  como um valor selecionado de verdade** (não acopla ao placeholder).
  Pra um select opcional/"nada selecionado ainda" onde o estado do
  form guarda `""` internamente (padrão desse projeto pros outros
  campos de texto), passar `value={form.algumId || null}` no
  componente `Select`, não `value={form.algumId}` direto (2026-07-14,
  `scoringTemplateId` em categorias e `cloneFromId` no template).
- **`dotenv` v17.x imprime uma "dica" aleatória a cada carga do
  `.env`** (`console.log`, array `TIPS` fixo no pacote) — a maioria
  aponta pro produto irmão `dotenvx.com`, mas uma delas anuncia um
  domínio de terceiros (`vestauth.com`, "auth for agents"). Confirmado
  que é comportamento do próprio pacote publicado (não é injeção via
  código do projeto), inofensivo (só imprime, não executa nada), mas
  vale saber que não é bug nosso se aparecer de novo no log de
  `migration:run`/`migration:generate`.

## Comandos úteis

```bash
# subir Postgres local
docker compose up -d          # (ou sudo docker compose up -d)

# rodar o backend em modo dev
cd apps/api && npm run start:dev

# rodar o frontend em modo dev (proxy /api -> localhost:3000)
cd apps/web && npm run dev    # ou, da raiz: npm run dev:web

# adicionar um componente shadcn/ui novo
cd apps/web && npx shadcn@latest add <componente>

# migrations
npm run migration:generate -- src/migrations/NomeDaMigration
npm run migration:run
npm run migration:revert
```

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
**Frontend (ainda não iniciado):** React + Vite + TypeScript + TailwindCSS
+ Framer Motion + Zustand
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

## Estrutura do repositório

Cada domínio (`auth`, `users`, `events`, `categories`, `teams`, ...) é uma
pasta autocontida em `apps/api/src/`, com `controllers/` e `services/`
como subpastas próprias dentro dele (não pastas globais compartilhadas
entre domínios). `dto/`, `entities/`, `*.module.ts` ficam na raiz de cada
domínio. Padrão a seguir para novos domínios (`Regulation`,
`ScoringRule`, `Routine`, `ScoreEvent`, `Result`, etc).

```
easyjudge/
├── apps/
│   └── api/                    # NestJS
│       ├── src/
│       │   ├── auth/           # registro, verificação de email, senha, login, JWT
│       │   │   ├── controllers/
│       │   │   ├── services/   # AuthService, MailService (stub)
│       │   │   ├── dto/ entities/ guards/ decorators/ strategies/ types/
│       │   │   └── auth.module.ts
│       │   ├── users/          # entidade User e CRUD básico
│       │   │   ├── services/
│       │   │   ├── entities/
│       │   │   └── users.module.ts
│       │   ├── events/         # Event (jornada "criar evento", parte 1)
│       │   │   ├── controllers/ services/ dto/ entities/
│       │   │   └── events.module.ts   # exporta EventsService (usado por categories/teams)
│       │   ├── categories/     # Category, aninhada em /events/:eventId/categories
│       │   │   ├── controllers/ services/ dto/ entities/
│       │   │   └── categories.module.ts
│       │   ├── teams/          # Team, aninhada em /events/:eventId/teams
│       │   │   ├── controllers/ services/ dto/ entities/
│       │   │   └── teams.module.ts
│       │   ├── common/         # enums, validators e config compartilhados (CPF/CNPJ, senha forte, upload de logo)
│       │   ├── migrations/     # migrations do TypeORM
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── data-source.ts      # config do TypeORM CLI (separado do app.module.ts)
│       └── .env                # DATABASE_URL, JWT_SECRET, PORT (não commitado)
├── packages/                   # vazio por enquanto (shared-types entra quando o front começar)
├── docker-compose.yml          # Postgres local
└── package.json                # raiz do workspace
```

## Jornada do usuário (ordem de implementação)

Jurado e produtor têm a mesma jornada de auth/cadastro; o que diverge é o
que cada um vê/faz depois de logado (controlado por `role` + guards).

Ordem de construção definida:
1. **Auth + User** — ✅ feito (ver "Status atual" abaixo)
2. **Jornada do jurado** — login → ver evento/rotinas atribuídas → atribuir
   notas em tempo real (ainda não iniciado)
3. **Jornada do produtor** — criar evento, cadastrar jurados/rotinas, painel
   de acompanhamento em tempo real, apuração de resultado (ainda não iniciado)
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
- `MailService` é um **stub** (só loga no console) — precisa plugar um
  provider real (Resend, SendGrid ou SES) antes de qualquer teste com
  usuário de verdade
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
  - `Category`: nome, vinculada a um evento (`eventId`) — ainda sem a
    regra de pontuação (será uma entidade própria, a detalhar)
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

## Próximos passos (não iniciados ainda)

1. Detalhar e modelar `Regulation` (regulamento do evento) e
   `ScoringRule` (regra de pontuação vinculada a cada categoria)
2. Modelar o restante da jornada do jurado: `Routine` (rotinas/equipes
   competindo em uma categoria), `ScoreEvent` (event sourcing das notas),
   `Result`
3. Decidir e implementar mecanismo de tempo real (WebSocket/Socket.io ou
   Supabase Realtime) para o painel do produtor
4. Iniciar o frontend (`apps/web`) — ainda não existe nenhum arquivo de front

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

## Comandos úteis

```bash
# subir Postgres local
docker compose up -d          # (ou sudo docker compose up -d)

# rodar o backend em modo dev
cd apps/api && npm run start:dev

# migrations
npm run migration:generate -- src/migrations/NomeDaMigration
npm run migration:run
npm run migration:revert
```

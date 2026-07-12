# easyJudge

Plataforma SaaS para gestão de notas e resultados em tempo real em
competições de cheerleading. Jurados atribuem notas, produtores gerenciam
a competição e acompanham o resultado, e atletas consultam sua própria
nota (última jornada a ser construída). Nesta fase, jurado tem as mesmas
permissões de produtor (pode criar e gerenciar eventos também).

> Nota: para decisões técnicas, gotchas e contexto detalhado voltado a
> desenvolvimento assistido por IA, veja [`CLAUDE.md`](./CLAUDE.md). Este
> README é a porta de entrada para quem só quer rodar o projeto e
> acompanhar o progresso.

## Stack

- **Backend:** NestJS + TypeScript + TypeORM + PostgreSQL
- **Frontend:** React + Vite + TypeScript + TailwindCSS + Framer Motion +
  Zustand (ainda não iniciado)
- **Banco local:** Postgres via Docker Compose
- **Monorepo:** npm workspaces (`apps/*`, `packages/*`)

## Como rodar localmente

Pré-requisitos: Node.js, Docker.

```bash
# 1. instalar dependências (raiz do monorepo)
npm install

# 2. subir o Postgres local
npm run docker:up          # ou: docker compose up -d

# 3. configurar variáveis de ambiente da API
cp apps/api/.env.example apps/api/.env
# preencher JWT_SECRET com um valor próprio

# 4. rodar as migrations
cd apps/api
npm run migration:run

# 5. subir a API em modo dev
npm run start:dev          # ou, da raiz: npm run dev:api
```

A API sobe em `http://localhost:3000` (ou na porta definida em `PORT`).

## Progresso

### ✅ Concluído

- Monorepo (npm workspaces) + Postgres local (Docker Compose)
- Auth completo: registro → verificação de email (código de 6 dígitos) →
  definição de senha → login, com JWT
  - Fluxo validado ponta a ponta via curl em 2026-07-12
- Validação de CPF/CNPJ e senha forte
- Jornada "criar evento" (parte 1): `POST /events`, `POST
  /events/:eventId/categories`, `POST /events/:eventId/teams`, `GET
  /events`, `GET /events/:id`
  - Guards `@Roles()` aplicados pela primeira vez (jurado e produtor
    autorizados, atleta bloqueado com 403)
  - Fluxo validado ponta a ponta via curl em 2026-07-12
- Logo opcional para evento e equipe (`POST /events/:id/logo` e
  `POST /events/:eventId/teams/:teamId/logo`, upload multipart) —
  armazenamento local em disco por enquanto, servido em `/uploads/...`

### 🚧 Em andamento / próximos passos

1. Detalhar `Regulation` (regulamento) e `ScoringRule` (regra de
   pontuação por categoria)
2. Modelar `Routine`, `ScoreEvent` (event sourcing das notas) e `Result`
3. Decidir e implementar mecanismo de tempo real (WebSocket/Socket.io ou
   Supabase Realtime) para o painel do produtor
4. Iniciar o frontend (`apps/web`)

### 📋 Backlog (não iniciado)

- Jornada do jurado em si (ver evento/rotinas atribuídas, atribuir notas
  em tempo real)
- Painel de acompanhamento em tempo real e apuração de resultado
- Jornada do atleta (consulta de nota e resultado)
- Provider real de email (o `MailService` atual é um stub que só loga no
  console)
- Deploy (Neon/Supabase para Postgres em produção)

## Requisitos não-negociáveis do produto

- **Notas nunca podem ser perdidas** — event sourcing (append-only) +
  buffer local no navegador com fila de retry.
- **Velocidade percebida** — optimistic UI na tela de scoring do jurado.
- **Minimizar custo** — é uma POC; preferir free tiers.

## Estrutura do repositório

Cada domínio em `apps/api/src/` (`auth`, `users`, `events`, `categories`,
`teams`, ...) é autocontido, com `controllers/` e `services/` como
subpastas próprias.

```
easyjudge/
├── apps/
│   └── api/                    # NestJS
│       ├── src/
│       │   ├── auth/           # registro, verificação de email, senha, login, JWT
│       │   ├── users/          # entidade User e CRUD básico
│       │   ├── events/         # Event + jornada "criar evento"
│       │   ├── categories/     # Category (aninhada em /events/:eventId/categories)
│       │   ├── teams/          # Team (aninhada em /events/:eventId/teams)
│       │   ├── common/         # enums, validators e config compartilhados
│       │   └── migrations/     # migrations do TypeORM
│       └── .env.example
├── packages/                   # vazio por enquanto (shared-types entra com o front)
├── docker-compose.yml          # Postgres local
└── package.json                # raiz do workspace
```

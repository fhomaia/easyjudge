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
- **Frontend:** React + Vite + TypeScript + TailwindCSS v4 + shadcn/ui +
  Zustand + React Router
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

# 6. em outro terminal, subir o frontend
cd apps/web
npm run dev                # ou, da raiz: npm run dev:web
```

A API sobe em `http://localhost:3000` (ou na porta definida em `PORT`).
O frontend sobe em `http://localhost:5173` e faz proxy de `/api/*` para
a API (configurado em `apps/web/vite.config.ts`).

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
- Frontend iniciado (`apps/web`): fluxo de auth completo — login, popup
  "criar conta" como assistente conversacional (uma pergunta por etapa,
  com resumo antes de enviar), sessão persistida, rotas protegidas/de
  convidado
  - Testado ponta a ponta com navegador headless em 2026-07-12
- Identidade visual: logo e favicon (raio azul/amarelo, tema esportivo)
  em `apps/web/public/`, paleta de marca aplicada em todo o app. Fundo
  animado de entrada (`BrandBackdrop`, Framer Motion): um raio risca a
  tela escura, um clarão estoura, e revela a tela dividida em duas fotos
  de competições de cheerleading (uma de cada lado do raio), com uma
  camada de cor azul/amarelo por cima e borda branca marcando a divisão
- Visual do card de login/cadastro refinado: fonte Plus Jakarta Sans,
  cantos bem menos arredondados, mais espaçamento, botões maiores e uma
  cor primária mais suave/dessaturada (separada do azul vivo do fundo)
- Email de verificação enviado de verdade via Resend (antes só logava
  no console) — hoje só entrega pra `easyjudgepro@gmail.com` (sandbox,
  domínio próprio ainda não verificado)
- Telas de "criar evento" completas: evento (com upload de logo),
  categorias (com formato/modalidade/divisão/nível/tempo de
  apresentação) e equipes/programas
- Setup do evento com checklist de 5 etapas (Regulamento, Categorias,
  Programas e equipes, Painel de jurados, Cronograma) — as 2 últimas
  ainda são placeholders "disponível em breve"
- **Sistema de pontuação** (`scoring-templates`): biblioteca pessoal de
  templates reutilizáveis entre eventos, com árvore de critérios
  (grupos/itens, drag-and-drop pra reordenar/reparentar), clonagem de
  um template existente ao criar outro, e indicador de "completo"
  (soma dos critérios-raiz bate com a meta de pontos)
- **Regulamento do evento** (`regulations`): upload de documentos
  (regulamento oficial, regras de segurança, documentos adicionais com
  título customizado), tabela de deduções de pontos (padrão ou
  customizada), e vitrine dos sistemas de pontuação do usuário
- Categorias agora exigem um sistema de pontuação **completo**
  atribuído (validado no backend, não só na UI) — excluir um sistema
  de pontuação em uso por categorias é bloqueado
- **Programas e equipes**: `ProgramParticipation` (instituição/academia
  num evento) + `ProgramProfile` (perfil canônico do programa, 1:1 com
  a conta própria) + catálogo do produtor (evita recadastrar o mesmo
  programa em cada evento, com validação de duplicidade) + merge
  automático quando o programa cria conta na plataforma. `Team` é um
  domínio próprio aninhado (equipes de um programa, ligadas a
  categorias)
- **Painel de jurados (base no backend)**: mesmo padrão de
  catálogo/perfil canônico/dedup dos programas aplicado a jurados
  (`judges`) — ainda sem tela própria, só a API

### 🚧 Em andamento / próximos passos

1. Modelar `Routine`, `ScoreEvent` (event sourcing das notas) e `Result`
2. Construir as telas de "Painel de jurados" e "Cronograma" (hoje
   placeholders no checklist de setup do evento)
3. Decidir e implementar mecanismo de tempo real (WebSocket/Socket.io ou
   Supabase Realtime) para o painel do produtor
4. Endereçamento estável de evento por `aliasId` nas rotas HTTP (hoje é
   pelo `id` de uma versão específica)

### 📋 Backlog (não iniciado)

- Jornada do jurado em si (ver evento/rotinas atribuídas, atribuir notas
  em tempo real)
- Painel de acompanhamento em tempo real e apuração de resultado
- Jornada do atleta (consulta de nota e resultado)
- Verificar domínio próprio no Resend (hoje só entrega email pra
  `easyjudgepro@gmail.com`, a conta usada pra criar a API key)
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
│       │   ├── scoring-templates/  # ScoringTemplate + ScoringCriterion (árvore de pontuação)
│       │   ├── regulations/    # Regulation + RegulationDocument (1:1 com Event)
│       │   ├── common/         # enums, validators e config compartilhados
│       │   └── migrations/     # migrations do TypeORM
│       └── .env.example
│   └── web/                    # React + Vite (Tailwind v4, shadcn/ui, Zustand, React Router, Framer Motion)
│       ├── public/             # logo.png, favicon.png (identidade visual)
│       └── src/
│           ├── api/            # client.ts — chamadas à API
│           ├── store/          # auth.ts — sessão (Zustand + persist)
│           ├── pages/          # LoginPage, HomePage, EventSetupPage, CategoriesPage,
│           │                    # RegulationPage, ScoringTemplatesListPage/BuilderPage
│           └── components/     # RegisterDialog, rotas protegidas, BrandBackdrop, ui/ (shadcn)
├── packages/                   # vazio por enquanto (shared-types entra quando fizer sentido)
├── docker-compose.yml          # Postgres local
└── package.json                # raiz do workspace
```

# easyJudge

Plataforma SaaS para gestão de notas e resultados em tempo real em
competições de cheerleading. Usada por jurados (atribuem notas) e
produtores de evento (gerenciam a competição e acompanham o resultado).
Atletas terão acesso de consulta (própria nota + resultado por categoria),
mas essa jornada é a última a ser construída.

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

## Estrutura do repositório

```
easyjudge/
├── apps/
│   └── api/                    # NestJS
│       ├── src/
│       │   ├── auth/           # registro, verificação de email, senha, login, JWT
│       │   ├── users/          # entidade User e CRUD básico
│       │   ├── common/         # enums e validators compartilhados (CPF/CNPJ, senha forte)
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

## Próximos passos (não iniciados ainda)

1. Testar o fluxo completo de `/auth/register` → `/auth/verify-email` →
   `/auth/set-password` via curl/Postman
2. Modelar entidades da jornada do jurado: `Event`, `Routine`
   (times/atletas), `ScoreEvent` (event sourcing das notas), `Result`
3. Aplicar `@Roles()` nos primeiros endpoints protegidos
4. Decidir e implementar mecanismo de tempo real (WebSocket/Socket.io ou
   Supabase Realtime) para o painel do produtor
5. Iniciar o frontend (`apps/web`) — ainda não existe nenhum arquivo de front

## Gotchas / decisões técnicas já resolvidas (não repetir o troubleshooting)

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

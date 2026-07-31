# easyJudge

Plataforma SaaS para gestão de notas e resultados em tempo real em
competições de cheerleading. Usada por jurados (atribuem notas) e
produtores de evento (gerenciam a competição e acompanham o resultado).
Atletas têm acesso de consulta (própria nota + resultado, via vínculo
com o programa — ver módulo `athletes`) e espectadores podem entrar num
evento publicado escaneando um QR/digitando um código (ver módulo
`events`, `EventsService.joinByCode`).

**Nota sobre este arquivo (2026-07-27):** entre 2026-07-19 e 2026-07-26
foi construída uma quantidade grande de funcionalidade — lançamento de
notas de verdade (`scoring`, event sourcing em `ScoreEvent`), o painel
"evento ao vivo" inteiro (Início/Cronograma/Notas/Resultados/
Notificações do jurado, do produtor e do programa), o módulo
`notifications`, a jornada do atleta (`athletes`, vínculo
atleta↔programa) e a feature de impersonation — sem que este arquivo
fosse atualizado (os commits desse período são grandes e squashed, sem
o detalhamento de decisão que o resto deste arquivo tem). As seções
"Jornada do usuário" e "Próximos passos" abaixo foram corrigidas nos
fatos básicos (o quê já existe), mas **não têm o mesmo nível de detalhe
de decisão/gotcha que o resto do arquivo** pra esse período específico
— só a partir da seção "Fluxo de desistência de apresentação" (2026-07-26)
em diante este arquivo volta a ter o detalhamento de sempre.

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

Uso inicial: **somente desktop** pras telas de configuração/gestão do
evento (Setup, Cronograma-construtor, Painel de jurados, etc.) — mobile
não é prioridade pra essas. **Atualização:** as telas *operacionais* do
"evento ao vivo" (jurado lançando nota, atleta/espectador consultando,
programa acompanhando as próprias equipes) são **mobile-first**, mesmo
app web, não um projeto nativo separado — decisão tomada quando esse
painel foi construído, já que quem usa essas telas está literalmente no
chão da competição com o celular na mão. As telas com `AppSidebar`
completa (Início/Cronograma/Resultados/Notificações/Notas do painel ao
vivo) têm layout desktop também, mas o mobile continua sendo o alvo
principal de design pra elas.

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
  generoso (Neon para Postgres em produção, decidido e em uso desde
  2026-07-30 — ver seção "Deploy de produção" mais abaixo; localmente
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
- Postgres via Docker local em dev, **Neon em produção** (migrado
  2026-07-30 — evitou custo de POC até ter domínio/deploy real).
- Monorepo com npm workspaces (`apps/*`, `packages/*`) em vez de repos
  separados para front/back: tipos compartilhados, menos overhead de
  gerenciamento para time pequeno/solo nesta fase.
- Event sourcing nas notas (tabela `score_events` append-only, nunca
  UPDATE) em vez de armazenar só o valor atual: garante auditoria e
  elimina risco de sobrescrever/perder uma nota.
- Logos de evento/equipe e documentos de regulamento: armazenamento
  local em disco (`uploads/`) em dev, **Cloudflare R2 em produção**
  (migrado 2026-07-30, junto com a migração do Postgres — mesmo
  raciocínio de custo, ver "Deploy de produção" mais abaixo).
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
`regulations`, `scoring`, `notifications`, `athletes`, ...) é uma pasta
autocontida em `apps/api/src/`, com `controllers/` e `services/` como
subpastas próprias dentro dele (não pastas globais compartilhadas entre
domínios). `dto/`, `entities/`, `*.module.ts` ficam na raiz de cada
domínio. Mesmo padrão a seguir para os próximos domínios.

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
│       │   ├── scoring/        # ScoreEvent (event sourcing append-only, nunca UPDATE) —
│       │   │   │                # lançamento de notas de verdade + apuração de resultado;
│       │   │   │                # inclui WithdrawalController (desistência de apresentação)
│       │   │   ├── controllers/ services/ dto/ entities/ enums/
│       │   │   └── scoring.module.ts
│       │   ├── notifications/  # Notification — avisos in-app (evento iniciado, apresentação
│       │   │   │                # cancelada, súmulas liberadas, etc.), audiência ALL/STAFF
│       │   │   ├── controllers/ services/ entities/ enums/
│       │   │   └── notifications.module.ts
│       │   ├── athletes/       # AthleteLink — vínculo atleta<->programa (pedido pelo atleta ou
│       │   │   │                # cadastrado pelo programa; confirmedAt libera conteúdo de notas)
│       │   │   ├── controllers/ services/ dto/ entities/
│       │   │   └── athletes.module.ts
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
│       │   ├── pages/          # LoginPage, HomePage, JoinEventPage (/join/:code),
│       │   │   │                # EventSetupPage, EventStaffPage, EventHistoryPage,
│       │   │   │                # CategoriesPage, ProgramsPage, RegulationPage,
│       │   │   │                # JudgingPage, SchedulePage,
│       │   │   │                # ScoringTemplatesListPage/BuilderPage,
│       │   │   │                # AthletesManagementPage, AthleteProgramsPage,
│       │   │   │                # EventLiveDashboardPage/SchedulePage/NotesPage/
│       │   │   │                # ResultsPage/NotificationsPage/ScoringPage/TeamNotesPage
│       │   │   │                # ("evento ao vivo" — /events/:id/live/...)
│       │   ├── components/     # RegisterDialog, ProtectedRoute, GuestRoute, FormError,
│       │   │   │                # AppSidebar (nav completa, usada por toda tela "ao vivo"),
│       │   │   │                # ShareEventDialog/JoinByCodeDialog (código+QR de evento),
│       │   │   │                # BrandBackdrop (raio riscando a tela -> clarão -> split azul/amarelo)
│       │   │   └── ui/         # componentes shadcn/ui (gerados via CLI, editáveis)
│       │   ├── lib/utils.ts    # helper `cn` (shadcn), scheduleTime.ts, scheduleConflicts.ts,
│       │   │   │                # dndProjection.ts, useEventSetupGuard.ts, useEventLiveGuard.ts,
│       │   │   │                # eventMemberRoles.ts, eventNavPriority.ts, pendingJoinCode.ts
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
2. **Jornada do jurado** — ✅ feito. Login → painel "evento ao vivo"
   (`/events/:id/live`, `EventLiveDashboardPage`) → tela de Notas
   (`/live/notes`, lista as apresentações que o jurado julga, vindas de
   `CriterionJudgeAssignment`) → lançar nota de verdade
   (`/live/scoring/:entryId`, `EventLiveScoringPage`), com o event
   sourcing em `ScoreEvent` (módulo `scoring`, append-only) prometido
   nos requisitos não-negociáveis.
3. **Jornada do produtor** — ✅ feito. Setup do evento, painel "evento ao
   vivo" (Início/Cronograma/Notas administrativas/Resultados/
   Notificações — mesmas rotas `/live/*` acima, conteúdo varia por
   papel), liberação de notas/resultado (`Event.scoresReleasedAt` etc.,
   ver `ReleaseFlagsPanel`) e apuração de resultado
   (`/live/results`, `ResultsController`). Mecanismo de tempo real
   ainda não decidido (painel hoje usa polling, não WebSocket/SSE — ver
   "Próximos passos").
4. **Jornada do atleta** — ✅ feito, via vínculo com o programa (módulo
   `athletes`, `AthleteLink`): atleta pede vínculo ou o programa
   cadastra o atleta; o programa precisa **confirmar**
   (`AthleteLink.confirmedAt`) pra liberar o conteúdo das próprias
   notas (`/live/team`-equivalente pro atleta, `AthleteNotesOverview` +
   `ScoringService.getAthleteOverview`) — o papel `EventMemberRole.
   ATHLETE` em si já é concedido na criação/resolução do vínculo,
   independente da confirmação (ver `AthletesService.
   syncEventAccessForLink`).
5. **Jornada do espectador genérico** — ✅ feito (2026-07-27, ver seção
   "Código + QR de evento" mais abaixo): qualquer usuário autenticado
   pode entrar num evento publicado escaneando o QR ou digitando o
   código do evento, ganhando `EventMemberRole.SPECTATOR` — sem
   precisar de convite manual no roster.

Fluxo de cadastro completo (já implementado):
login → "criar conta" (popup) → escolhe role (judge/athlete/organization)
→ preenche nome, sobrenome, documento (CPF/CNPJ), email, nome da
equipe/instituição (opcional) → recebe email com código de 6 dígitos →
digita código → tela de definir senha (mín. 8 caracteres, maiúscula,
número, caractere especial) + confirmar senha → conta criada e já loga
(retorna JWT) → redireciona para home.

## Status atual (o que já está pronto e testado)

**Nota (2026-07-28):** o log detalhado de decisão/gotcha do período
2026-07-12 → 2026-07-19 (auth, users, events, categories, teams,
scoring-templates, regulations, programs, judges, judging, schedule,
event-staff, redesenho visual de login/cadastro/home) foi movido para
`docs/CLAUDE_HISTORY.md` — este arquivo tinha passado do limite de
150k caracteres suportado como instrução de projeto. Esse arquivo não
é carregado automaticamente; abra-o sob demanda quando precisar do
"porquê" de uma decisão antiga que não esteja resumida aqui. A
estrutura de módulos resultante desse período já está refletida em
"Estrutura do repositório" e "Jornada do usuário" acima — nada disso
foi perdido, só o detalhamento passo a passo de como se chegou lá.

O log a partir de 2026-07-19 (refatoração de `EventMember` por pessoa
+ `event-staff`) continua abaixo, no mesmo nível de detalhe de sempre.

- **Fluxo de desistência de apresentação (2026-07-26).** Antes não
  existia forma de marcar que uma equipe desistiu de uma apresentação
  — a notificação "[apresentação] cancelada" já estava prevista no
  enum desde antes, mas ficou deliberadamente sem uso até essa
  funcionalidade existir.
  - **Modelo**: `ScheduleEntry` ganhou `withdrawnAt: Date | null`
    (nunca é limpo de volta, mesmo espírito de
    `contestationRequestedAt`) e `removedFromSchedule: boolean` (só
    admin/assessor liga; controla só a visão de TIMELINE do
    cronograma, nunca a das súmulas).
  - **Autorização** (`ScoringService.withdrawPresentation`): admin/
    assessor podem desistir de qualquer apresentação e decidir remover
    do cronograma; programa só das próprias equipes (checado via
    `assertProgramOwnsTeam`), sempre com `removeFromSchedule = false`
    forçado (não é decisão dele). Só é possível enquanto a apresentação
    não tem **nenhum** `ScoreEvent` (cronômetro contado como "já
    começou").
  - **Efeito no cronograma**: como o horário nunca é persistido (é
    sempre `order` × `durationMinutes` computado no cliente, ver
    `lib/scheduleTime.ts`), uma apresentação com `removedFromSchedule`
    é filtrada **antes** do cálculo de horário
    (`lib/scheduleWithdrawal.ts`, chamado no topo de
    `computeFullSchedule`/`computeEventLiveSchedule`) — as
    apresentações seguintes da mesma pista já recuam automaticamente
    pra preencher o vão, sem nenhum recálculo/reconciliação explícita
    (foi só um efeito colateral do algoritmo de soma sequencial já
    existente, confirmado com um teste manual: remover uma apresentação
    de 5min fez as duas seguintes recuarem exatamente 5min).
  - **Súmulas**: `getAdminOverview`/`buildTeamScopedOverview`
    (`ScoringService`) normalmente só listam apresentação 100%
    pontuada — ganharam uma exceção: apresentação desistida entra
    mesmo incompleta, sempre com `withdrawn: true` e resultado zerado.
    Badge "Desistência" (mesmo tom vermelho de "Contestação") em
    `AdminNotesOverviewList`/`EventLiveNotesPage`/
    `EventLiveNotesDesktopView`, linha desabilitada/dessaturada.
  - **Bloqueio de nota**: `buildScoreEventRows` rejeita (403) qualquer
    `ScoreEvent` novo pra uma apresentação com `withdrawnAt` setado.
  - **Notificação**: `ScheduleService.setWithdrawn` (não
    `ScoringService`, por já ter acesso a `Event`/`Team` ali) dispara
    `NotificationType.PRESENTATION_CANCELLED` pra audiência `ALL`.
  - **UI**: `EventLiveSchedulePage` ganhou menu "⋯" por linha tipo
    `presentation` ("Sinalizar desistência", condicional a admin/
    assessor ou programa dono da equipe), `WithdrawPresentationDialog`
    (checkbox "remover do cronograma" só aparece pra admin/assessor).

- **Bug real achado e corrigido durante o teste manual desta feature**:
  `ScheduleController.getDays` (rota que `EventLiveSchedulePage`
  precisa pra carregar o cronograma) nunca liberava acesso pra
  `UserRole.PROGRAM`/`EventMemberRole.PROGRAM` — só JUDGE/ADMIN/
  ASSESSOR (o `@Roles` de classe do controller nunca incluiu PROGRAM,
  só a rota `days` tinha um `@EventRoles` de método que também
  esquecia PROGRAM). Isso bloqueava silenciosamente a tela de
  cronograma inteira pra qualquer usuário-programa — nunca tinha sido
  pego porque não existia nenhum `EventMember` com papel `program` no
  banco até esta sessão criar um pra testar a própria feature de
  desistência. Corrigido adicionando PROGRAM aos dois níveis, mesmo
  padrão já usado ali pra JUDGE.

- **Layout desktop da tela "Notas" do programa + roteamento da aba
  "Notas" (2026-07-27).** `EventLiveTeamNotesPage` (`/live/team`,
  visão do programa sobre as notas das próprias equipes) tinha sido
  construída sem `AppSidebar` de propósito ("tela enxuta"), mas isso
  deixava o conteúdo espremido num container `max-w-2xl` centralizado
  em telas largas — diferente de todas as outras telas do evento ao
  vivo (Cronograma/Resultados/Notificações/Notas do jurado), que já
  usam a `AppSidebar` completa incondicionalmente pra qualquer papel.
  Corrigido dando a ela o mesmo split mobile/desktop que
  `EventLiveNotesPage`/`EventLiveNotesDesktopView` já usa (mobile
  enxuto preservado, `hidden lg:flex` com `AppSidebar` completa no
  desktop).
  - **Bug relacionado, corrigido junto**: a aba "Notas" da navegação,
    em **todas** as páginas do evento ao vivo, estava com o destino
    fixo em `/live/notes` (a página do jurado/admin/atleta) —
    pra um usuário-programa isso sempre caía na mensagem "Você não
    está escalado como jurado". Criada `resolveNotesHref(eventId,
    roles)` em `lib/eventNavPriority.ts` (mesma regra de precedência
    já usada pelo redirect `onlyProgram` de `EventLiveDashboardPage`:
    só quem é EXCLUSIVAMENTE programa vai pra `/live/team`, todo o
    resto — mesmo acumulando `program` com outro papel — vai pro hub
    `/live/notes`), aplicada nos 5 pontos que geravam esse link.

- **Código + QR de evento pra acesso de espectador (2026-07-27).**
  Ao publicar um evento pela primeira vez, ele ganha um `eventCode`
  (8 caracteres, alfabeto sem `0/O/1/I/L` pra evitar confusão ao
  digitar à mão, gerado com `crypto.randomInt` — sem dependência nova,
  não existia nenhum gerador de código/slug no projeto) — estável
  através das versões (igual a `aliasId`), carregado adiante em toda
  republicação (`EventsService.publishEvent`: `eventCode: event.
  eventCode ?? (await this.generateUniqueEventCode(manager))`).
  - **Gotcha real, achado e corrigido durante o teste manual**: o
    índice único do `event_code` **precisa** ser parcial em `active =
    true` (`CREATE UNIQUE INDEX ... WHERE event_code IS NOT NULL AND
    active = true`, mesmo padrão de `IDX_events_alias_id_active`) — a
    primeira versão da migration só filtrava `event_code IS NOT NULL`,
    e como a versão antiga (desativada) de um evento **mantém** o
    `event_code` gravado pra sempre (é histórico, nunca é limpo),
    republicar um evento colidia com o próprio código da versão
    anterior e estourava 500 (`23505` do Postgres). Pego só porque o
    fluxo de teste incluiu publicar → despublicar → republicar o mesmo
    evento — vale lembrar desse padrão ("coluna estável entre versões,
    mas a versão antiga não é limpa") sempre que uma feature nova
    precisar de uma coluna única carregada adiante em `publishEvent`.
  - **Resgate**: `POST /events/join-by-code` (`EventsController`, sem
    `@Roles`/`EventMemberGuard` — mesmo padrão de `GET /events/:id`,
    que já é alcançável por qualquer usuário autenticado sem
    membership prévia) normaliza a entrada
    (`trim().toUpperCase().replace(/[^A-Z0-9]/g, '')`), acha o evento
    ativo por `eventCode`, exige status `published`/`started`/
    `completed` (`VISIBLE_TO_NON_STAFF`, reaproveitado), e chama
    `EventsService.upsertMemberRole(aliasId, SPECTATOR, ...)` — método
    já existente (usado pelo sync automático de jurado/programa/
    atleta), idempotente: se a pessoa já tem qualquer papel, só
    acrescenta SPECTATOR ao array, nunca duplica linha nem rebaixa
    quem já é admin/jurado.
  - **QR renderizado no cliente** (`qrcode.react`, única lib nova,
    `QRCodeCanvas`) codificando `${origin}/join/${eventCode}` — sem
    endpoint de imagem no backend, mesmo raciocínio de evitar
    storage/complexidade desnecessária pra uma POC. "Baixar QR"
    exporta o canvas via `toDataURL('image/png')` + link `download`
    sintético; "Copiar código" usa `navigator.clipboard.writeText`
    (primeiro uso de clipboard no projeto).
  - **`/join/:code`** (`JoinEventPage`, rota pública — fora de
    `GuestRoute`/`ProtectedRoute` de propósito, precisa funcionar nos
    dois estados de auth): já logado, resgata na hora e navega pra
    `/events/:id/live/results` — não `/live` — porque
    `useEventLiveGuard` (usado por Início/Cronograma/Notas) não libera
    `SPECTATOR` por padrão, só `EventLiveResultsPage` passa
    `allowSpectator: true`; é a única página que um espectador
    recém-chegado tem garantia de conseguir abrir sem ser
    redirecionado de volta pra Home. Deslogado, guarda o código em
    `localStorage` (`lib/pendingJoinCode.ts` — chave própria, uso
    único, lê e já limpa) e manda pro login; `LoginPage` consome o
    código pendente (melhor esforço, erro ignorado) tanto no login
    quanto no `onSuccess` do cadastro, antes do `navigate("/")` de
    sempre — não existe (e não foi construído) nenhum mecanismo
    genérico de "volta pra onde eu estava depois do login" no app
    (`ProtectedRoute`/`GuestRoute` sempre redirecionam pra destino
    fixo); esse `localStorage` isolado é escopado só pra este fluxo.
  - **UI**: `ShareEventDialog` (novo) acionável de dois lugares —
    `PublishEventCard` (branch "já publicado" do Setup) e um item novo
    "Compartilhar evento" em `EventActionsMenu` (Home, admin-only,
    `event.status !== "created"`). `JoinByCodeDialog` (novo) + botão
    "Tenho um código" no cabeçalho da Home, ao lado de "Novo evento".
  - **`eventCode` não tem endpoint próprio** — vai junto no payload
    normal de `Event`/`EventWithRole` pra qualquer membro (mesmo nível
    de exposição que `aliasId`/`createdById` já têm hoje); só a UI é
    que restringe o botão de compartilhar a admin. Eventos publicados
    **antes** desta feature ficam com `eventCode: null` até a próxima
    republicação (sem backfill) — `ShareEventDialog` mostra uma
    mensagem nesse caso em vez de quebrar.

- **Bug latente corrigido: `ROLE_PRECEDENCE` não incluía `ATHLETE`**
  (`EventsService`, achado ao responder uma pergunta do usuário sobre
  o cenário "usuário que entrou via QR como espectador depois vira
  atleta confirmado de uma equipe do evento"). Como
  `upsertMemberRole` só ACRESCENTA papel (nunca remove), esse usuário
  fica com `roles: ['spectator', 'athlete']` — e como `ATHLETE` não
  estava na lista de prioridade usada por `highestRole()` (que reduz
  o array pro campo singular `currentUserRole`, pra telas antigas que
  só entendem um papel), `SPECTATOR` vencia por omissão, não por
  desenho. Corrigido inserindo `ATHLETE` logo antes de `SPECTATOR` na
  lista. Era dormente até agora (nenhuma tela do frontend compara
  `currentUserRole` contra `"athlete"`/`"spectator"` — os guards que
  importam checam o array `currentUserRoles` inteiro, não o campo
  reduzido), mas ficaria incorreto no dia que alguma tela passasse a
  confiar nesse campo pra distinguir os dois papéis.

- **Transição `started` -> `completed` ("Concluir evento",
  2026-07-27).** Fecha a lacuna que só tinha `created` ⇄ `published` →
  `started` — `EventStatus.COMPLETED` já existia no enum desde a
  migration de status original, mas sem nenhuma rota que
  transicionasse pra ele (ver item 2 antigo de "Próximos passos").
  Decisão de regra (pedida ao usuário): 100% manual, sem nenhum
  gatilho automático por data/fim de `competitionDays` — mesma
  filosofia de `startEvent`, só que **admin e assessor** podem
  concluir (`EventsService.completeEvent`, allowedRoles
  `[ADMIN, ASSESSOR]`), diferente de `startEvent`/`publishEvent`, que
  continuam admin-only. Pedido explícito do usuário: assessor também
  gerencia o ciclo de vida operacional do evento ao vivo, não só
  configurações antes de publicar.
  - **Backend**: `Event.completedAt` (nullable, nunca reescrito, mesmo
    padrão de `startedAt`) + `EventActivityAction.COMPLETED` +
    `POST /events/:id/complete` (in-place, não versiona — igual
    `startEvent`). Bloqueia (`409`) fora de `status=started`.
  - **Gotcha real, pego no teste manual via curl**: `EventActivityAction`
    (enum TypeScript) ganhar um valor novo **não é suficiente** — o
    Postgres tem seu próprio tipo `enum` pra essa coluna
    (`event_activity_logs_action_enum`, criado por
    `CreateEventActivityLogs`/ampliado por `ExpandEventActivityLog`) e
    precisa de uma migration própria (`ALTER TYPE ... ADD VALUE`) pra
    aceitar `'completed'`. Sem ela, `activityLogService.record(...)`
    deu `500` (`22P02 invalid input value for enum`) **depois** que o
    `UPDATE` do `Event.status` já tinha sido salvo com sucesso (as duas
    escritas não estão numa transação compartilhada, mesmo padrão já
    aceito em `startEvent`/`publishEvent`/`unpublishEvent`) — ou seja,
    o evento silenciosamente virava "completed" de verdade mesmo com a
    resposta HTTP sendo um erro 500. Corrigido com uma migration
    dedicada (`AddCompletedToEventActivityLogAction`, `ADD VALUE`
    direto, sem precisar do rename→create→cast→drop completo já que é
    só uma adição). **Vale lembrar deste padrão** ("todo valor novo de
    `EventActivityAction` precisa de uma migration Postgres própria,
    não só do enum TS") na próxima vez que uma ação de ciclo de vida
    ganhar um valor novo.
  - **Frontend**: botão "Concluir evento" (roxo/`violet-500`,
    `BlinkingDot` — mesmo componente do "Iniciar evento" emerald e do
    "Ao vivo" vermelho, só a cor muda) nos 3 lugares onde "Iniciar
    evento" já aparecia — `EventLifecycleAction` (Home, lista e grade),
    `EventLiveDashboardPage` (mobile) e `EventLiveDesktopView`
    (desktop) — sempre ao lado do indicador de status existente, nunca
    no lugar dele (pedido explícito do usuário: "além da tag ao vivo").
    **Diferente de Iniciar/Publicar** (que chamam a API direto no
    clique): o clique só abre um `ConfirmDialog` (mesmo componente
    genérico já usado pra excluir/reverter publicação) — a chamada de
    verdade (`eventsApi.complete`) só acontece na confirmação, pedido
    explícito do usuário ("deve abrir popup de confirmação"). Na Home,
    estado (`completeTarget`) e diálogo vivem em `HomePage`; no painel
    ao vivo, como o botão existe tanto na visão mobile quanto desktop
    (que são dois blocos JSX/componentes distintos renderizados juntos
    por `EventLiveDashboardPage`), o estado do diálogo
    (`completeDialogOpen`) também vive só no componente pai, com um
    único `ConfirmDialog` compartilhado pelas duas visões (evita
    duplicar o popup por view).

## Endereçamento por `aliasId` nas rotas HTTP (2026-07-27)

Fecha de vez o item que ficava pendente desde 2026-07-19 (o refactor
interno das entidades filhas do evento — ver "Atualização (2026-07-19)"
no topo do arquivo — já endereçava `categories`/`program_participations`/
`schedule_days`/etc. por `aliasId`, mas as ROTAS HTTP ainda esperavam o
`id` de uma versão específica). Pesquisa feita antes de tocar em código
confirmou que nenhuma feature real dependia de endereçar uma versão
antiga e inativa pelo `id` dela — o próprio backend já tratava isso como
erro (`getOwnEventOrThrow` rejeitava `active=false` com `409`), e a tela
de "Histórico" (`EventActivityLog`) já é só uma lista de ações via
`aliasId`, nunca precisou resolver o conteúdo de uma linha `Event`
específica antiga.

- **O que mudou de verdade**: só a RESOLUÇÃO do parâmetro de rota, em
  toda parte que antes fazia `eventsRepo.findOneBy({ id })`. Os PATHS
  em si não mudaram (continuam `/events/:id`, `/events/:eventId/...`) —
  só o que o valor desse parâmetro precisa SER, que passou de "o `id`
  de uma versão específica" para "o `aliasId` (estável através das
  republicações)". `EventsService.findEventOrThrow`/`getOwnEventOrThrow`
  (usados por praticamente todo domínio filho — categories, programs,
  teams, judges, judging, schedule, regulations, scoring, event-staff,
  member-counts) agora fazem `findOneBy({ aliasId, active: true })` em
  vez de `findOneBy({ id })`; `EventsService.findOneForUser` (`GET
  /events/:id`) idem. `getOwnEventOrThrow` perdeu o `if (!event.active)
  throw ConflictException(...)` — virou código morto, já que uma versão
  antiga simplesmente não é mais encontrável por `aliasId` (antes disso
  dava pra "achar" o `id` de uma versão antiga e essa checagem barrava a
  ação com `409`; agora o mesmo caso dá `404`, não existe mais como
  estado intermediário).
- **`NotificationsService.resolveMemberOrThrow`** tinha uma query
  duplicada própria (`eventsRepo.findOneBy({ id: eventId })`, não passa
  por `EventsService` de propósito — evita import cíclico, ver
  comentário no arquivo) — precisou do mesmo ajuste manualmente.
- **`ProgramsService.findAllForUser`/`JudgesService.findAllForUser`**
  (`GET /programs/me`/`GET /judges/me`, catálogo do próprio usuário
  PROGRAM/JUDGE através de todos os eventos onde participa): faziam um
  join manual (`event.aliasId = p.aliasId AND event.active = true`) e
  devolviam `event.id` como `eventId` pro frontend, com um comentário
  explícito dizendo que isso "precisava continuar sendo um id de versão
  navegável" — exatamente o ponto que este refactor deveria revisitar.
  Trocado pra devolver `p.aliasId` diretamente (o join com `Event`
  continua existindo, só que agora exclusivamente pra trazer
  `eventName`/`startDate` de exibição, não mais o identificador).
- **Frontend**: nenhuma rota do `App.tsx` mudou (`/events/:id/setup`,
  `/events/:id/live/...` etc. continuam com o mesmo path) — só o VALOR
  guardado nesse `:id` mudou, então as ~15 páginas que só repassam
  `useParams().id` pra `xApi.list(id)` **não precisaram de nenhuma
  edição** (o `id` da URL já vira aliasId automaticamente assim que a
  navegação que leva até ali passa a usar `event.aliasId`). O trabalho
  de verdade foi trocar todo `event.id` por `event.aliasId` nos pontos
  que constroem a PRIMEIRA navegação pra dentro do evento ou
  chamam um endpoint de mutação do próprio evento
  (`eventsApi.update/publish/start/unpublish/complete/remove/
  uploadLogo`) — `HomePage.tsx`, `EventGridItem.tsx`/`EventListItem.tsx`,
  `EditEventDialog.tsx`/`CreateEventDialog.tsx`/`PublishEventCard.tsx`,
  `EventSetupPage.tsx`, `lib/eventSetupSteps.ts`, e as 8 páginas/
  componentes do painel "evento ao vivo" (`EventLiveDashboardPage`,
  `EventLiveDesktopView`, `EventLiveSchedulePage`, `EventLiveNotesPage`/
  `EventLiveNotesDesktopView`, `EventLiveResultsPage`,
  `EventLiveNotificationsPage`, `EventLiveTeamNotesPage`,
  `JoinEventPage`) — cerca de 60 ocorrências ao todo. `HomePage.tsx`
  já usava `aliasId` em dois lugares antes disso (`handleEventUpdated`/
  `handleEventJoined`, pra não duplicar item na lista local depois de
  um republish) — essa era a evidência de que o design já sabia do
  problema; agora `startingId`/`publishingId` (tracking de qual card
  está em loading) e as `key` de lista também passaram a usar
  `aliasId`, mais estável que `id` através de um republish.
- **Testado via curl** (evento criado → publicado → despublicado →
  republicado de novo, gerando 3 `id`s de linha diferentes sob o mesmo
  `aliasId`): `GET /events/:aliasId` sempre devolve a versão ATIVA mais
  recente, não importa quantas vezes o evento foi republicado; `GET`/
  `POST .../start` usando o `id` de uma versão antiga (agora inativa)
  dá `404` (antes do refactor, `GET` funcionava pra sempre nessa versão
  velha, e ações de escrita davam `409` "versão antiga" em vez de
  `404`); endpoints filhos (`member-counts`, `staff`, `notifications`,
  `schedule/days`, `programs`) resolvem certo usando o `aliasId` como
  `:eventId`.
- **Ponta solta consciente**: existe um processo Node rodando
  `dist/src/main` (build antigo, anterior a este refactor) numa porta
  local — não foi tocado durante o teste (identidade/origem incerta,
  não criado nesta sessão); os testes acima rodaram numa porta separada
  pra não interferir nele. Vale conferir/reiniciar esse processo antes
  de testar a feature manualmente pelo navegador, senão o comportamento
  observado será o antigo (pré-refactor).

## Ajustes no ciclo de vida do evento (2026-07-27, mesmo dia da feature "Concluir evento")

Rodada de refinamentos pedidos depois de ver a primeira versão de
"Concluir evento" (ver seção acima) funcionando.

- **Botões "Publicar evento"/"Concluir evento" saíram da listagem da
  Home** (`EventLifecycleAction.tsx` simplificado — só "Iniciar evento"
  continua ali, único que o usuário pediu pra manter). Publicar segue
  acessível pelo menu "⋯" (`EventActionsMenu`, inalterado); concluir
  segue acessível só pela tela "Início" do evento ao vivo (ver item
  abaixo) — não existe mais nenhum caminho pra concluir a partir da
  Home. `HomePage.tsx` perdeu `completeTarget`/`handleComplete`/o
  `ConfirmDialog` de conclusão (viraram código morto) e `publishingId`
  inteiro (não tinha mais nenhum lugar que lesse esse estado depois que
  o botão saiu da listagem).
- **"Concluir evento" na tela "Início" agora fica no lado OPOSTO da
  tag "Evento em andamento"/horário de início** (pedido explícito do
  usuário) — em vez de `gap-2` colado à tag, o container virou
  `justify-between` (desktop, `EventLiveDesktopView.tsx`) ou dois
  `<div>`s separados dentro do mesmo `justify-between` (mobile,
  `EventLiveDashboardPage.tsx`, onde "Concluir evento" agora agrupa com
  "Ir para agora" no lado direito, já que os dois brigavam pelo mesmo
  espaço).
- **Copy trocado**: popup de confirmação de "Concluir evento" —
  `"Esta ação encerra o evento em definitivo. Deseja prosseguir?"`
  (era `"O evento sai de \"Ao vivo\"..."`); `ShareEventDialog` —
  `"Escaneie o QR code para acessar {nome do evento}"` (era
  `"Quem escanear o QR ou digitar o código ganha acesso de
  espectador..."`).
- **`EditEventDialog` trava campos + oferece "Reverter publicação" pra
  evento `published` OU `started`** (antes: campos sempre editáveis,
  inclusive pra `published` — salvar silenciosamente revertia o status
  pra `created` por trás, sem avisar; `started` já dava 409 genérico do
  backend, sem UI própria). Agora: `isLocked = status === "published" ||
  status === "started"` desabilita todos os campos
  (`EventFormFields`/`DatePicker` ganharam prop `disabled`) e mostra um
  banner âmbar "Reverta a publicação do evento para editar"; o botão
  vira "Reverter publicação", que abre o MESMO `ConfirmDialog` (mesmo
  copy) já usado na Home/tela Início. **Depois de reverter com
  sucesso, o popup de edição continua aberto** (só o `ConfirmDialog`
  interno fecha) — os campos voltam a ficar editáveis e o botão volta a
  "Salvar alterações" sozinho, porque `onUpdated` (agora
  `HomePage.handleEditDialogUpdated`) atualiza tanto a lista `events`
  quanto o próprio `editTarget` que o dialog recebe via prop, disparando
  o `useEffect` que resincroniza o form.
  - **Decisão do usuário, veio de uma pergunta de esclarecimento**:
    `EventsService.unpublishEvent` passou a aceitar `started -> created`
    também (antes só `published -> created` — reverter um evento "ao
    vivo" era descrito como "decisão consciente, fica pra quando isso
    for pedido"; agora foi pedido). Zera `event.startedAt` nessa
    transição (senão sobraria um "iniciado em ..." de uma sessão
    anterior). **Decisão deliberada, confirmada com o usuário
    (2026-07-28) — não é pendência, não mexer sem pedido explícito**:
    reverter um `started` que já tem `ScoreEvent` lançado não é
    bloqueado de propósito — os dados de nota continuam no banco (event
    sourcing), a competição só volta a aparecer como "criada" com notas
    já registradas por trás disso. Usuário optou por manter assim.
- **Bug real pego durante o teste manual (não introduzido nesta
  rodada, mas exposto por ela)**: `publishEvent`/`startEvent`/
  `unpublishEvent`/`completeEvent`/`updateEvent` devolvem o `Event` via
  `EventsService.attachRole`, que **não inclui**
  `categoriesCount`/`programsCount` (só existem na resposta de
  `findAllForUser`/`findOneForUser`, ver tipo `EventWithRole`). Antes,
  qualquer ação de ciclo de vida disparada da Home (`handleStart`,
  `handlePublish`, reverter via "⋯") substituía o item da lista local
  inteiro por essa resposta "mais magra", zerando a contagem exibida
  até o próximo refresh da página. Ficou muito mais visível com o
  revert de dentro do `EditEventDialog` (mesma tela, sem navegar,
  então o "zerado" ficava óbvio). Corrigido em
  `HomePage.handleEventUpdated`: em vez de substituir o item inteiro,
  faz merge preservando `categoriesCount`/`programsCount`/
  `categoriesUpdatedAt`/`programsUpdatedAt` do item antigo quando a
  resposta não os traz (`event.categoriesCount ?? e.categoriesCount`).
- **Incidente real durante o teste desta feature**: ao verificar
  visualmente o fluxo "Reverter publicação" pelo navegador (sessão já
  logada como o usuário real), o clique de teste **reverteu de
  verdade** o evento real "Easy Judge Cup" de `started` pra `created`
  — perdendo o `startedAt` original (zerado por
  `unpublishEvent`, sem como recuperar). O usuário optou por deixar
  como está e ajustar manualmente depois, em vez de eu tentar
  "restaurar" (republicar geraria uma versão nova com `startedAt`
  novo, não o original). Lição registrada em memória — testes visuais
  de ações que mutam estado devem usar um evento descartável, não a
  conta real logada no Chrome.

## Mover apresentação durante o evento ao vivo (2026-07-27)

Feature nova na tela "Cronograma completo" (`EventLiveSchedulePage.tsx`,
`/events/:id/live/schedule`): admin/assessor podem mudar a pista e/ou
a posição de uma apresentação já agendada **enquanto o evento está
rolando**, sem precisar voltar pro construtor de cronograma do Setup.

- **Decisão de design consultada com o usuário antes de implementar**:
  popup (escolher pista + posição), não drag-and-drop — tela é
  mobile-first e arrastar é impreciso num evento já em andamento, sob
  pressão. Mesma interação em mobile e desktop (não dois padrões
  diferentes). Escopo explicitamente **admin/assessor apenas** (pedido
  do usuário) — programa continua só com "Sinalizar desistência".
- **Reaproveita o endpoint de mover que já existia** pro construtor de
  cronograma do Setup (`PATCH .../schedule/days/:dayId/entries/:entryId/move`,
  usado pelo drag-and-drop de `SchedulePage.tsx`) — guards já eram
  admin/assessor-only, não precisou de nenhuma mudança de permissão.
- **Só move apresentações dentro do MESMO dia** (o endpoint não suporta
  trocar de dia) e só a partir do menu "⋯" de uma linha `presentation`
  não desistida — mesmo padrão de menu já usado pra "Sinalizar
  desistência" (`WithdrawPresentationDialog`), agora com um item
  "Mover apresentação" adicional quando `canMove` (admin/assessor).
- **`MovePresentationDialog.tsx`** (novo componente): pista (`Select`,
  só recursos com `supportsPresentations`) + posição (`Select` com
  opções "No início da pista" / "Antes de {equipe}" pra cada
  apresentação já na pista de destino / "No fim da pista"). O `order`
  numérico mandado pro backend é calculado como **índice dentro do
  array de siblings da pista de destino, DEPOIS de excluir a própria
  apresentação e qualquer entry ligada a ela por `linkedEntryId`
  (ex.: o intervalo "Aguardando aquecimento" quando vive na mesma
  pista)** — reproduz exatamente o que
  `ScheduleService.movePresentationWithWarmup`/
  `createPresentationWithWarmup` fazem de verdade no banco (código
  lido e a matemática validada via curl com um cenário de 2 equipes/2
  apresentações antes de confiar nisso — mover a apresentação A com
  `order=1` colocou A imediatamente antes de B, exatamente como a
  opção "Antes de Equipe B" previa). **Sem preview de conflito** — o
  backend nunca rejeita por sobreposição de horário (sempre absorve
  deslocando aquecimento/intervalos automaticamente), só bloqueia
  presentation → recurso sem `supportsPresentations` ou sem área de
  aquecimento vinculada; um aviso informativo no popup já cobre a
  expectativa ("O aquecimento e os intervalos automáticos são
  reorganizados sozinhos, se precisar").
  - **Default de posição pensado pra evitar mover sem querer**: se a
    pista escolhida é a mesma de origem, a posição pré-selecionada é a
    que representa "não mudar nada" (a próxima apresentação que já vem
    depois dela hoje) — confirmar sem tocar em nada não move a
    apresentação pro fim da pista à toa.
  - Depois de mover, a página recarrega `scheduleApi.listDays` inteiro
    (`refreshDays`, já existia pro fluxo de desistência) — a resposta
    do próprio `moveEntry` só devolve a entry movida, insuficiente pra
    refletir tudo que mudou (aquecimento recalculado, intervalos
    automáticos inseridos/removidos em outros recursos).

- **Bug real de perda de dados encontrado e corrigido durante o teste
  manual desta feature** (`ScheduleService.movePresentationWithWarmup`,
  já existia antes — usado também pelo drag-and-drop do Setup, não é
  bug introduzido por esta feature, só exposto por ela): mover uma
  apresentação pra uma pista **sem área de aquecimento vinculada**
  fazia o método remover a apresentação (e seu aquecimento antigo)
  **antes** de tentar recriar no destino — e como
  `createPresentationWithWarmup` só valida a existência de aquecimento
  vinculado (`getAvailableWarmupResourceForMat`) DEPOIS dessa remoção,
  sem nenhuma transação cobrindo o método inteiro, a falha (`409`)
  acontecia tarde demais: a apresentação já tinha sido apagada e nunca
  era recriada em lugar nenhum — **perda de dado real durante um
  evento ao vivo seria catastrófico aqui**. Corrigido repetindo a
  mesma checagem de `getAvailableWarmupResourceForMat` bem no início de
  `movePresentationWithWarmup`, ANTES de qualquer remoção — vira `409`
  cedo, sem tocar em nada. Confirmado via curl: a mesma operação que
  antes apagava a apresentação agora falha e o estado da pista de
  origem fica bit-a-bit idêntico antes/depois. **Ponta solta
  consciente**: o método continua sem transação de verdade cobrindo
  remoção+recriação — a checagem adiantada cobre o caso concreto
  encontrado (aquecimento ausente), mas qualquer OUTRA exceção que
  `createPresentationWithWarmup` viesse a lançar no futuro (nova
  validação adicionada ali sem repetir aqui) teria o mesmo risco. Uma
  transação de verdade exigiria passar um `EntityManager` por toda a
  cadeia de métodos privados usados (`insertIntoResource`,
  `renumberResource`, `reconcileWarmupDelays`,
  `getAvailableWarmupResourceForMat`, etc.) — refactor maior, fora de
  escopo desta correção pontual.

- **Teste visual completo no navegador (2026-07-27), evento
  "Easy Judge Cup" — confirmado pelo usuário que este evento específico
  não é dado real, pode ser mexido livremente.** Cenário: uma equipe
  (Hurrycane) com duas apresentações (Nível 1 e Nível 2) na mesma pista,
  cada uma com aquecimento próprio na "Aquecimento 1" vinculada. Mover
  Nível 2 pra antes de Nível 1 (e depois o inverso, pra confirmar
  simetria) confirmou visualmente:
  - **Intervalo desnecessário é removido**: o "Aguardando disponibilidade
    da equipe" (atraso de aquecimento) que existia por causa da ordem
    antiga sumiu quando deixou de ser necessário.
  - **Aquecimento da apresentação MOVIDA é recalculado** pra continuar
    terminando a tempo da nova posição.
  - **Achado real inicial (corrigido logo em seguida, ver abaixo):** o
    aquecimento da apresentação **não movida** não acompanhava a
    mudança de posição da outra — ficava exatamente onde estava antes.
    Isso deixava dois aquecimentos da MESMA equipe seguidos na fila
    (ex.: aquece Nível 2, aquece Nível 1, só depois apresenta as duas)
    em vez de intercalado. Causa raiz: `createPresentationWithWarmup`
    sempre insere o aquecimento novo no FIM da fila de aquecimento
    atual, sem checar se isso deixa dois aquecimentos da mesma equipe
    adjacentes — `getTeamBusyWindows` só evita SOBREPOSIÇÃO de horário,
    não império uma ordem "aquecimento->apresentação->aquecimento->
    apresentação" entre categorias diferentes da mesma equipe.
  - **Corrigido a pedido do usuário**: nova função
    `ScheduleService.reconcileTeamWarmupOrder(dayId, teamId)` — depois
    de criar/mover uma apresentação, verifica se algum par de
    aquecimentos da MESMA equipe (no mesmo recurso de aquecimento) está
    "invertido" (aquecimento A antes de aquecimento B na fila, mas
    apresentação A depois da apresentação B no horário) e corrige
    **trocando a ORDEM dos dois aquecimentos** (não o conteúdo — cada
    aquecimento continua vinculado à própria apresentação via
    `linkedEntryId`), repetindo até não sobrar par invertido. Chamada
    em `movePresentationWithWarmup` **e** em `createEntry` (o mesmo
    problema podia ocorrer numa criação normal, não só num move, se a
    equipe já tivesse outra categoria agendada).
  - **Segundo bug real, pego testando a PRÓPRIA correção acima**: o
    usuário notou que sobrava um "Aguardando disponibilidade da equipe"
    de 10min bem no início do dia, antes até do primeiro aquecimento —
    sem nenhum motivo (nada precede o primeiro aquecimento do dia pra
    equipe "esperar"). Causa: `reconcileWarmupDelays`/
    `reconcileTeamWarmupOrder`/`reconcileMatGaps` são **interdependentes**
    (mudar uma pode tornar outra desatualizada) — rodá-las uma vez cada,
    numa ordem fixa terminando em `reconcileMatGaps`, deixava uma espera
    calculada por uma passada ANTERIOR de `reconcileWarmupDelays` sem
    nunca ser re-verificada depois que `reconcileMatGaps` (que roda por
    último) mudava a folga do lado da pista — a espera ficava obsoleta
    mas nunca era removida, porque não havia mais nenhuma chamada de
    `reconcileWarmupDelays` depois dela. Corrigido rodando as três em
    conjunto, dentro de um laço (3 repetições) seguido de uma
    `reconcileWarmupDelays` final — tanto em `movePresentationWithWarmup`
    quanto em `createEntry`. **Reconfirmado visualmente** repetindo o
    mesmo teste: `aquecimento1 (08:00-08:10) → apresentação1
    (08:10-08:11) → [1min legítimo, equipe ainda apresentando Nível 1] →
    aquecimento2 (08:11-08:21) → apresentação2 (08:21-...)` — sem
    nenhuma folga sobrando no início, só o mínimo necessário entre as
    duas categorias. Isso também resolve, na
    prática, a maior parte do "achado inicial" acima (aquecimento
    terminando cedo demais) — já que a intercalação correta naturalmente
    aproxima cada aquecimento do início da própria apresentação; o
    limite teórico ("nunca existe uma regra de máximo, só de mínimo")
    continua existindo pra casos que não envolvam duas categorias da
    mesma equipe, mas deixou de se manifestar neste cenário concreto.
  - **Terceiro bug real, mais profundo — pego repetindo o teste várias
    vezes seguidas na mesma dupla equipe+pista.** O usuário perguntou
    "será que foi um problema da criação do cronograma?" — não: a
    criação inicial (testada logo no começo) sempre saiu limpa. O
    problema é gerado pelo **mover**, especificamente por inserir uma
    apresentação "na frente" de outra que já tinha seu próprio intervalo
    "Aguardando aquecimento"/"Aguardando disponibilidade da equipe" —
    `insertIntoResource(resource.id, insertAt=0, ...)` empurra TUDO que
    já estava na pista pra depois, inclusive um intervalo que já
    pertencia certinho a uma apresentação mais adiante, sem que nada
    reconheça essa mudança de posição. `reconcileMatGaps`/
    `reconcileWarmupDelays` só verificam o item **imediatamente
    anterior** de cada apresentação/aquecimento — se o intervalo certo
    não está mais lá (porque outra coisa foi inserida entre ele e a
    apresentação dele), o código nunca o reconhece como "seu" e cria um
    novo do zero, deixando o antigo "órfão" espalhado pelo cronograma
    pra sempre (confirmado via SQL direto: dois intervalos "Aguardando
    aquecimento" com `linked_entry_id` apontando pra apresentação 2,
    mas fisicamente posicionados ANTES da apresentação 1). Minha
    primeira tentativa de correção (fundir intervalos CONSECUTIVOS do
    mesmo tipo) não resolvia isso, porque os intervalos órfãos nem
    ficavam consecutivos ao intervalo certo — ficavam espalhados perto
    de uma apresentação diferente da deles. **Correção definitiva**:
    trocar a checagem de "funde vizinhos" por uma limpeza mais geral,
    rodada no início de cada passada de `reconcileMatGaps`/
    `reconcileWarmupDelays` — para cada intervalo "Aguardando
    aquecimento"/"Aguardando disponibilidade da equipe", verifica se o
    item que vem logo DEPOIS dele é de fato a apresentação/aquecimento
    ao qual está vinculado (`linkedEntryId`); se não for, o intervalo
    está "perdido" e é removido (o resto da reconciliação recria um
    novo, corretamente posicionado, se ainda for necessário). Testado
    via SQL direto no banco em dois sentidos (mover Nível 1 antes de
    Nível 2, depois o inverso de novo) — resultado final sempre com
    exatamente um intervalo por apresentação, vinculado e posicionado
    corretamente, sem sobra nem duplicata, estável em movimentações
    repetidas.
  - **Bug visual real pego e corrigido**: o `Select` de "Posição" no
    popup, com um rótulo longo tipo "Antes de Hurrycane · Group Stunt
    All Star COED Nível 1", estourava a largura do `DialogContent`
    inteiro (o `SelectTrigger` do shadcn usa `w-fit` +
    `whitespace-nowrap` por padrão — sem uma largura própria pra
    truncar contra, o `line-clamp-1` do componente base não tem efeito
    nenhum). Mesmo problema, mesma correção já usada em outro lugar do
    projeto (`EventLiveSchedulePage.tsx`, filtros de Programa/Equipe):
    `className="w-full min-w-0"` no `SelectTrigger` + `className="truncate"`
    no `SelectValue`, forçando o trigger a respeitar a largura do
    container em vez de crescer com o conteúdo.

## Notificação e log ao mover apresentação (2026-07-27)

Complemento da feature "Mover apresentação" (ver seções acima): ao mover
uma apresentação com sucesso, dispara notificação (audiência `ALL` —
"quem vê? todos", pedido explícito do usuário) e registra no histórico
do evento — **só quando o evento não está mais `created`** (fase de
construção do cronograma, no Setup, não notifica ninguém; a partir de
`published`/`started`/`completed`, sim).

- **`NotificationType.PRESENTATION_MOVED`** (`'presentation_moved'`) e
  **`EventActivityAction.PRESENTATION_MOVED`** (mesmo valor de string,
  namespaces/enums diferentes) — cada um com sua própria migration
  `ALTER TYPE ... ADD VALUE` no Postgres (mesmo gotcha já documentado
  antes neste arquivo: enum TS novo não é suficiente sozinho).
  `EventActivityAction.PRESENTATION_MOVED` é uma exceção explícita à
  decisão de 2026-07-26 de deixar cronograma de fora do log de
  atividade — só essa ação específica, e só fora de `created`, tem
  valor de auditoria real o suficiente pra justificar a exceção.
- **`ScheduleService.moveEntry`** ganhou parâmetro `userId` (novo, o
  controller agora usa `@Req() req: AuthenticatedRequest` — antes não
  precisava). Só o caminho de `presentation` notifica/loga (o "move
  simples" de aquecimento/intervalo/abertura/premiação não gera nada
  disso — mover uma apresentação é o evento que importa pra plateia).
  Helper privado `notifyPresentationMoved(eventId, teamName, userId)`
  busca o `Event` de novo (`eventsService.findEventOrThrow`, mesmo
  padrão redundante já aceito em `setWithdrawn`) só pra ler `.status`/
  `.aliasId` — sai cedo (`return`) se `status === CREATED`.
- **Título da notificação**: `"${teamName} teve a apresentação
  remanejada no cronograma"`. Sem `scheduleEntryId` (a apresentação
  movida ganha um `id` novo no processo — mover é remove+recria, ver
  seção "Mover apresentação" acima —, então não há um id estável pra
  vincular; o clique na notificação leva direto pro cronograma
  completo, mesmo destino de `presentation_cancelled`, não precisa de
  deep-link pra uma entry específica).
- **Testado via `fetch` direto na página** (não pelo popup — o clique
  do mouse estava travando na sessão do Chrome nesta rodada de teste,
  gotcha de ferramenta registrado, não do código) nos dois sentidos:
  evento `published` → mover apresentação → notificação `ALL` +
  entrada no log aparecem; revertido pra `created` → mover a mesma
  apresentação de novo → contagem de notificações e de log permanece
  EXATAMENTE igual (nenhuma nova linha) — confirma a condição de
  status funcionando nos dois lados.

- **Download de súmula impressa a partir do sistema de pontuação
  (2026-07-27, layout revisado 3x na mesma sessão).** Ícone de download
  (`apps/web/src/lib/scoringTemplateExport.ts`,
  `exportScoringTemplateToPdf`/`exportScoringTemplateToExcel`) ao lado
  da engrenagem em cada `ScoringTemplateCard` (listagem,
  `ScoringTemplatesListPage`) **e** no cabeçalho de
  `ScoringTemplateBuilderPage` (a tela de edição) — o pedido original
  citava as duas telas.
  - **A listagem não carrega os critérios do template** (`ScoringTemplate`
    da listagem não tem a árvore, só `criteriaCount`) — o clique no
    ícone dispara `scoringCriteriaApi.list(template.id)` sob demanda,
    só quando o usuário efetivamente escolhe baixar (PDF ou Excel), não
    no carregamento da página inteira.
  - **Bug real achado e corrigido durante o teste manual (via
    `javascript_tool`, clique de mouse real indisponível nesta sessão
    — mesmo gotcha de ferramenta já registrado na seção "Mover
    apresentação"):** escolher "Baixar como PDF"/"Baixar como Excel"
    no menu da listagem também **navegava** pra página do template,
    como se tivesse clicado no card inteiro. Causa: `DropdownMenuContent`
    é renderizado num **portal do React** (`MenuPrimitive.Portal`,
    anexado fora da subárvore DOM do card) — mas o sistema de eventos
    sintéticos do React borbulha conforme a **árvore de componentes
    JSX** (o `DropdownMenu` está aninhado dentro do `motion.div` que
    tem `onClick={onClick}`), não conforme o DOM real. Então o clique
    num item do menu borbulhava através do React até o `onClick` do
    card, mesmo o item nunca tendo sido um descendente DOM dele. Os
    botões de engrenagem/lixeira nunca tiveram esse problema por serem
    `<button>` normais (sem portal) dentro do próprio card, com
    `stopPropagation()` de DOM de verdade já bastando. Corrigido com
    `onClick={(e) => e.stopPropagation()}` no próprio
    `DropdownMenuContent` (intercepta antes de subir mais na árvore
    React) — vale lembrar desse padrão (portal + card clicável) se
    outro menu suspenso for colocado dentro de um elemento com `onClick`
    de navegação.
  - **Layout final do PDF é texto corrido, não tabela** (revisado a
    partir de uma 2ª imagem de referência trazida pelo usuário — uma
    súmula real da International Cheer Union — sem copiar a
    marca/logo/nome da organização, só a estrutura): cada critério-folha
    vira um bloco "NOME    X pts ________________" (nome em negrito à
    esquerda, pontuação + linha em branco alinhados à direita, mesmo
    padrão da referência), seguido da descrição do critério, se houver
    (`ScoringCriterion.description`, `doc.splitTextToSize` pra quebra de
    linha). Grupos viram só um cabeçalho em negrito CAIXA-ALTA
    introduzindo os critérios abaixo (indentados por profundidade,
    `INDENT_STEP`) — sem "pts"/linha em branco própria, já que quem
    recebe nota é sempre o item de avaliação (folha), nunca o grupo.
    Isso **substituiu completamente** a primeira versão (tabela via
    `jspdf-autotable` com células de fundo colorido) — `jspdf-autotable`
    não é mais usado neste arquivo (só sobrou em `scheduleExport.ts`).
  - **Divisão entre grupos-raiz nunca corta no meio, mesmo mudando de
    página** (pedido explícito do usuário, depois de ver a 1ª versão
    tabular truncando um grupo entre páginas): cada critério de nível
    raiz (um grupo com a subárvore inteira, ou um item de avaliação
    solto na raiz) é tratado como uma seção atômica. `layoutNode` (a
    mesma função, com uma flag `draw`) primeiro MEDE a altura da seção
    inteira sem desenhar nada, decide se cabe no resto da página atual
    e só depois desenha de verdade — garante que medição e desenho nunca
    divirjam (calculado com a mesma função, não duas versões
    paralelas). Só um espaço extra (`SECTION_GAP`) entre seções pode
    cair numa quebra de página, nunca o meio de uma. **Limitação aceita,
    não é pendência (confirmado com o usuário em 2026-07-28)**: um
    grupo-raiz sozinho maior que uma página inteira não tem como
    respeitar essa regra — não é um cenário real (um grupo-raiz desse
    tamanho não corresponde a nenhum template plausível), não vale
    complexidade extra pra cobrir.
  - **Altura das linhas "de nota" evoluiu em 3 rodadas nesta sessão**:
    1ª versão pedia linhas "5x mais altas" (tabela, `minCellHeight:
    110`); 2ª rodada pediu encolher pra caber numa página só (cálculo
    dinâmico dividindo o espaço restante); 3ª rodada (depois de ver o
    layout de tabela) pediu deixar a divisão entre grupos mais evidente
    e aceitar mais de uma página se precisar — o layout mudou de tabela
    pra texto corrido (ver acima), que já não tem "linha alta" nesse
    sentido (o espaço pra nota é só uma linha em branco inline, "pts
    ________________", como na referência do ICU).
  - **Campo "Campeonato" no topo** (pedido do usuário depois de ver o
    resultado): como `ScoringTemplate` não pertence a um evento
    específico (é uma biblioteca pessoal reutilizável entre eventos —
    ver topo deste arquivo), não dá pra preencher automaticamente o
    nome do campeonato; virou mais um campo em branco pro usuário
    escrever à mão, mesmo padrão de Equipe/Categoria/Juiz/Data, na
    primeira linha do bloco de campos (antes de Equipe/Categoria).
  - Excel ganhou uma coluna "Descrição" (mesma fonte,
    `criterion.description`), lado a lado com PDF.
  - Testado ponta a ponta em cada rodada (PDF e Excel, listagem e
    builder, com o template "Easy Judge Cup" — 21 critérios em 3 níveis
    de grupo — e "Coed Stunt (cópia)", com descrições adicionadas
    temporariamente via `fetch` só pra teste e revertidas depois):
    arquivo baixado de verdade, conteúdo/página inspecionados via
    `pdftotext`/`pdftotext -bbox`/`pdftoppm` (renderizado como imagem
    pra conferir visualmente a borda/indentação) e leitura direta do
    XML do `.xlsx`.

- **Trava de edição de sistema de pontuação em uso (2026-07-27).**
  Usuário pediu pra CONFERIR se um template já ficava travado quando
  usado por um evento fora de `created` — investigação (agente Explore)
  confirmou que **não existia nenhuma trava**: `ScoringTemplatesService.
  update`/`ScoringCriteriaService.create/update/remove/move` só
  checavam dono do template (`findOwnTemplateOrThrow`), nunca olhavam
  pra `Category`/`Event`. Implementado a pedido do usuário depois da
  confirmação.
  - **`ScoringTemplatesService.assertNotLockedForEditing(templateId)`**
    (novo, público): `409` se o template está referenciado por
    `Category.scoringTemplateId` de algum evento (versão `active`) com
    `status !== created`. Chamado em `update()` do template e, via
    `templatesService` já injetado, no início de `create`/`update`/
    `remove`/`move` de `ScoringCriteriaService` (logo depois do
    `findOwnTemplateOrThrow` que já existia em cada um). Read-only
    (`findAllForTemplate`/`findAllForTemplateUnchecked`) não é afetado —
    só mutação é bloqueada.
  - **`getLockedTemplateIds(templateIds)`** (privado): uma query só
    (`eventsRepo` com `innerJoin(Category, ...)`, `distinct(true)`) pra
    descobrir quais de uma lista de templates estão travados, evita
    N+1 em `findAllForUser` (listagem). `findOneForUser` (usado pelo
    builder) reusa o mesmo método com uma lista de 1 item.
  - **`ScoringTemplate.isLocked`** (novo campo computado, mesmo padrão
    de `distributedScore`/`isComplete` — não é coluna) preenchido em
    `findAllForUser`/`findOneForUser`, exposto no client.ts.
  - **Módulo**: `ScoringTemplatesModule` passou a registrar `Event` via
    `TypeOrmModule.forFeature` (só o repositório, não `EventsModule`
    inteiro — mesmo raciocínio já usado pra `Category`: evita
    dependência circular, já que `CategoriesModule` importa os dois).
  - **Frontend**: `ScoringTemplateCard` (listagem) ganhou um badge
    "Travado" (âmbar) ao lado do badge de completo, e o botão de
    engrenagem (editar nome/descrição/meta) fica desabilitado com
    `title` explicando o motivo — o botão de download continua ativo
    (baixar/imprimir um template travado continua fazendo sentido).
    `ScoringTemplateBuilderPage` mostra um banner âmbar
    (`isLocked = template?.isLocked`) e propaga `readOnly` pra
    `ScoringTreePanel` (esconde "Adicionar critério raiz", esconde
    adicionar-filho/excluir por linha, `useSortable({ disabled:
    readOnly })` trava o drag-and-drop) e `EditCriterionPanel` (todos
    os inputs/checkboxes/select com `disabled`, botão "Excluir"
    escondido). Edição do nome do template (botão de lápis inline no
    header do builder) também trava.
  - **Exclusão do template** (`remove()`) não precisou de mudança — já
    bloqueava incondicionalmente excluir um template em uso por
    qualquer categoria (independente do status do evento), uma regra
    mais forte que já cobria esse caso.
  - Testado via `fetch` direto no navegador (sessão já logada) contra
    dado real: o evento "Easy Judge Cup" (`published`, confirmado
    anteriormente pelo usuário como eventual dado descartável) tem 2
    templates em uso (`isLocked: true` na listagem) — `PATCH` no
    template e `PATCH`/`POST` de critério deram `409` nos dois; um
    template não usado por nenhum evento (`isLocked: false`) continuou
    aceitando `PATCH` normalmente. UI confirmada visualmente: badge
    "Travado" no card certo, banner + campos desabilitados no builder
    do template travado.

- **Documentos do regulamento acessíveis na tela "Início" do evento ao
  vivo (2026-07-27).** Até aqui, os documentos enviados na etapa de
  setup (`RegulationPage`, regulamento oficial/regras de
  segurança/documentos adicionais) só podiam ser vistos/baixados
  voltando pra tela de Setup — não tinha como abri-los durante o
  evento em si. Ícone de documento (`FileText`) num `DropdownMenu`,
  ao lado do botão "Mais opções"/"Reverter publicação" no desktop
  (`EventLiveDesktopView.tsx`) e do botão "Concluir evento" no mobile
  (`EventLiveDashboardPage.tsx`) — clicar lista os documentos
  (`regulation.documents`, cada um com o nome escolhido no upload) e
  escolher um abre o arquivo em nova aba
  (`window.open(doc.fileUrl, "_blank", "noopener,noreferrer")`).
  Desabilitado (com `title` explicando) quando não há regulamento
  carregado ainda ou nenhum documento foi enviado.
  - **`fileUrl` é usado direto como href, sem prefixo** — os uploads
    são servidos pela API fora do prefixo `/api` (`/uploads/...`, ver
    `main.ts`/`useStaticAssets`), com proxy próprio no Vite
    (`vite.config.ts`, mesmo padrão já usado por logos de
    evento/equipe) — mesmo raciocínio de `event.logoUrl` já usado em
    `<img>` em outros lugares do projeto.
  - **Backend precisou de override de rota**: `RegulationsController`
    tinha `@Roles(JUDGE, ORGANIZATION)` + `@EventRoles(ADMIN,
    ASSESSOR)` no nível da classe (só quem configura o evento podia
    ver o regulamento, incluindo o `GET`). Como a tela "Início" é vista
    por uma audiência bem mais ampla (mesma de `useEventLiveGuard`:
    admin/assessor/jurado/programa/atleta, não espectador — ver
    `event-member-role.enum.ts`), a rota `GET /events/:eventId/regulation`
    ganhou um override de método (`@Roles`/`@EventRoles` na própria
    rota), mesmo padrão já usado em `ScheduleController.getDays` —
    as outras rotas do controller (`PATCH`, upload/exclusão de
    documento) continuam admin/assessor only, só a leitura abriu.
  - **Frontend**: `regulationApi.get(id)` chamado no mesmo `useEffect`
    que já carrega `categories`/`days`/etc. em `EventLiveDashboardPage`,
    resultado (`Regulation | null`) repassado como prop nova
    (`regulation`) pro `EventLiveDesktopView` — mesmo padrão de
    "estado carregado uma vez no componente pai, repassado pros dois
    layouts" já usado pra `judges`/`programs`/`notifications` nessa
    página.
  - Testado com o evento real "Easy Judge Cup" (3 documentos
    cadastrados) via `fetch` direto (confirma `200` na nova permissão)
    e clique de verdade no navegador nos dois layouts (mobile e
    desktop, verificado via DOM — a tela renderiza os dois wrappers
    `lg:hidden`/`hidden lg:flex` sempre, só o CSS decide qual aparece,
    então dá pra testar as duas listas de documentos sem precisar
    redimensionar a janela de verdade): dropdown lista os 3 documentos
    nos dois, clique abre o PDF de verdade em nova aba
    (`document.contentType === "application/pdf"`, título do PDF
    carregado corretamente).

- **Faixas de pontuação opcionais num item de avaliação (2026-07-27).**
  Usuário pediu pra poder dividir a pontuação de um `score_item` em
  faixas nomeadas com cor (ex.: "Fraco" 0-20, "Excelente" 20-40) — "só
  efeito visual na tela do jurado, detalhamos isso depois" (esse efeito
  ainda **não foi implementado**, só o CRUD/modelo de dados e a tela de
  configuração no builder).
  - **Modelo**: `ScoringCriterion.useScoreBands` (boolean, default
    false) + `ScoringCriterion.scoreBands` (jsonb nullable, array de
    `{ name, color, min, max }`) — decisão consciente de usar jsonb em
    vez de uma entidade própria (ao contrário de `RegulationDocument`,
    por exemplo): as faixas são uma lista pequena e contida, sempre
    editada junto com o resto do critério no mesmo painel, sem
    reordenar/mover como os próprios critérios têm, então não
    justificava tabela+migration+controller próprios. Migration
    `AddScoreBandsToScoringCriteria`.
  - **Garantia pedida explicitamente pelo usuário** ("as faixas somadas
    contemplem o valor máximo declarado"): minha primeira implementação
    exigia cobertura **contígua** (sem sobreposição, `band[i].min ===
    band[i-1].max`) — o usuário corrigiu logo em seguida: sobreposição
    entre faixas é permitida de propósito, só falta de cobertura (vão)
    é erro. Reescrito como um sweep pelas faixas ordenadas por `min`:
    a primeira precisa começar em 0 (`sorted[0].min > 0` → erro);
    acumula `covered` (o quanto já está coberto sem vão, começando em
    `sorted[0].max`); pra cada próxima faixa, se `sorted[i].min >
    covered` há um vão (erro) — senão `covered = max(covered,
    sorted[i].max)` (sobreposição só estende ou mantém, nunca quebra);
    no fim, `covered` precisa alcançar `maxScore`. Validado em
    `ScoringCriteriaService.assertBandsCoverMaxScore`, chamado por
    `create`/`update` — **só quando `scoreBands` de fato faz parte do
    payload** (mudar só o nome/peso/maxScore do critério não força
    revalidar faixas já salvas, evitaria travar o autosave por-campo já
    usado no builder; cabe ao frontend avisar visualmente se as faixas
    ficarem desatualizadas depois de um `maxScore` mudar sem revisitá-las
    — não implementado, ponta solta consciente). Grupo (`type: group`)
    força `useScoreBands: false` + `scoreBands: null` automaticamente
    (grupo não recebe nota, não faz sentido ter faixa).
  - **Frontend nunca manda um payload inválido pro backend**: o desenho
    das faixas (`EditCriterionPanel`, novo estado `bandsDraft`) é
    livre/local — adicionar/editar/remover faixa atualiza a UI na hora,
    mas o autosave debounced (`handleBandsChange`, mesmo `DEBOUNCE_MS`
    já usado nos outros campos) só dispara a chamada de verdade
    (`persist({ scoreBands })`) quando `lib/scoreBands.ts`'s
    `validateScoreBands` (mesma regra do backend, duplicada só pro
    feedback ser instantâneo)
    já dá "válido" — enquanto inválido (ex.: acabou de clicar "Adicionar
    faixa" e ainda não preencheu o fim), o rascunho fica só local, com a
    mensagem de erro visível, sem round-trip nem 409 desnecessário.
    Testado via DOM que um estado transitoriamente inválido (um "buraco"
    entre faixas) realmente não dispara `PATCH` nenhum (servidor mantém
    o último estado válido salvo).
  - **Paleta de cor reaproveitada**: `ResourceColorPicker` (já existia
    pra cor de `ScheduleResource`, cronograma) usado tal e qual pra
    escolher a cor de cada faixa — mesma paleta fixa de 13 cores
    (`VIBRANT_COLORS`, `lib/avatarColor.ts`), sem criar um seletor
    novo. Novo componente `ScoreBandsEditor.tsx` (lista de faixas com
    nome/descrição/início/fim/cor + adicionar/remover) segue o mesmo
    padrão de "array controlado pelo pai" já usado em
    `CategoryLevelSelector.tsx` (estado vive no componente pai via
    `onChange`, sem chamar API diretamente).
  - **Descrição por faixa** (pedido em seguida, mesma sessão):
    `ScoreBand.description: string | null` (mesmo padrão nullable de
    `ScoringCriterion.description`) — textarea opcional por faixa em
    `ScoreBandsEditor`, sem entrar na validação de cobertura (é só
    texto livre, não afeta `min`/`max`). `ScoreBandDto.description` é
    opcional (`string | undefined`, vem ou não do client) mas a
    entidade guarda sempre `string | null` — `ScoringCriteriaService.
    normalizeBands` converte `undefined → null` antes de persistir
    (mesmo `create`/`update`), evitando o descompasso de tipo entre o
    DTO (campo opcional) e o formato salvo (sempre presente, nullable).
  - **Layout horizontal com scroll interno** (pedido em seguida, mesma
    sessão — "ao invés de ir empilhando cada faixa verticalmente,
    prefiro... scroll interno com as faixas alinhadas
    horizontalmente"): `ScoreBandsEditor` trocou `grid` (pilha vertical)
    por uma linha `flex overflow-x-auto` com cada faixa em um card de
    largura fixa (`w-60 shrink-0`) — o botão "Adicionar faixa" ficou,
    numa primeira versão, fixo na lateral fora da área rolável; o
    usuário pediu em seguida pra voltar com ele embaixo da lista (mesmo
    padrão anterior, só que agora abaixo de uma linha horizontal em vez
    de uma pilha vertical) — revertido nessa segunda rodada.
    **Bug real de vazamento de scroll, achado e corrigido durante o
    teste manual**: a primeira versão do scroll horizontal não ficava
    contida no componente — a página inteira (`<main>`, que tem
    `overflow-y-auto`) ganhava scroll horizontal, escondendo até a
    árvore de critérios do lado esquerdo. Causa: nem `display:grid`
    (track implícito de largura `auto`, baseada em conteúdo) nem
    `display:flex` limitam a largura de um item ao espaço disponível do
    pai por padrão — cada wrapper no caminho (`grid gap-2` em
    `EditCriterionPanel` → `grid gap-2` raiz do `ScoreBandsEditor` →
    `flex items-stretch gap-3` → o próprio `overflow-x-auto`) ia
    crescendo pra caber o conteúdo, em vez de ficar preso à largura do
    pai — e como nenhum desses tinha `overflow` diferente de `visible`,
    o conteúdo simplesmente vazava visualmente por cima de tudo, sem
    gerar scrollbar, até bater no primeiro ancestral que por acaso tinha
    overflow não-visible (o `<main>`, só por causa de uma regra do CSS:
    setar `overflow-y` diferente de `visible` força `overflow-x` a
    computar como `auto` também, quando ele não foi setado
    explicitamente). Corrigido adicionando `min-w-0` em CADA nível dessa
    cadeia (mesmo raciocínio do gotcha já visto no PDF de súmula: um
    filho só respeita a largura do pai em grid/flex se tanto ele quanto
    os ancestrais no caminho tiverem `min-width:0` — sem isso, a largura
    "automática" baseada no conteúdo sempre vence). Confirmado via
    `getBoundingClientRect`/`scrollWidth` em vez de screenshot (a
    ferramenta de screenshot deu vários timeouts nesta sessão) que,
    depois da correção, o container interno realmente ficou menor que o
    conteúdo (`clientWidth 342` vs `scrollWidth 1248`) e
    `document.documentElement.scrollWidth` bateu exatamente com
    `window.innerWidth` (sem vazamento pra página).
  - **Copy explicativo removido** (pedido do usuário): o parágrafo
    "Juntas, as faixas precisam cobrir de 0 até X pontos..." foi tirado
    de baixo do label "Faixas de pontuação" em `EditCriterionPanel` —
    a mensagem de validação (`ScoreBandsEditor`, já mostrada quando
    inválido) já cobre a explicação quando necessário.
  - **Incidente durante o teste desta rodada, não relacionado ao
    código**: o template "Coed Stunt (cópia)" (usado como template de
    teste em rodadas anteriores desta sessão) apareceu renomeado pra
    "Group stunt" com critérios novos ("Transições", "Composição da
    rotina") e horário de atualização de poucos minutos antes — sinal
    de edição concorrente no mesmo navegador/conta (usuário usando o
    app ao mesmo tempo, na mesma aba que a automação de teste
    controla). Identificado a tempo, sem nenhuma ação automatizada
    minha ali — testes desta rodada em diante migraram pra um template
    descartável criado e excluído só pra este teste
    (`[TESTE claude] layout faixas`), evitando qualquer interferência
    no template real do usuário.
  - Testado via DOM (clique real de mouse indisponível nesta sessão,
    mesmo gotcha de ferramenta já registrado antes): marcar o checkbox,
    adicionar 2 faixas cobrindo 0-40 (maxScore real do critério
    "Creativity" do template de teste "Coed Stunt (cópia)") salva com
    sucesso; criar um vão entre elas mostra a mensagem de erro e **não**
    salva (confirmado via `GET` — servidor manteve o estado anterior
    válido); desmarcar o checkbox limpa `useScoreBands`/`scoreBands` de
    volta a `false`/`null`; um `PATCH` direto via `fetch` com faixas que
    não cobrem o `maxScore` inteiro confirma `409` no backend (defesa em
    profundidade, não só validação client-side); critério do tipo grupo
    não mostra o checkbox. **Reconfirmado depois da correção pra
    permitir sobreposição**: duas faixas sobrepostas (0-25 e 15-40,
    cobrindo 0-40 sem vão) salvam normalmente (`GET` confirma as duas
    exatamente como enviadas, sem normalização/corte); reduzir a
    primeira faixa pra criar um vão de verdade (0-15 e 20-40, buraco
    15-20) volta a mostrar a mensagem de erro e não salva.

- **Efeito visual das faixas de pontuação na tela do jurado
  (2026-07-27).** Primeira implementação do que ficou prometido desde
  a feature original de faixas ("só efeito visual... detalhamos isso
  depois") — descrição clicável em grupo/item de avaliação, nome/cor
  da faixa atual e (desktop) um slider colorido por faixa.
  - **Backend**: `ScoringCriterionView`/`ScoringGroupView`
    (`scoring.service.ts`, usadas pela tela do jurado — API separada
    do builder de templates) ganharam `useScoreBands`/`scoreBands` e
    `description` (grupo) respectivamente. `buildGroups` só preenche
    `group.description` com a descrição do nó RAIZ da árvore (mesma
    simplificação que já existia: a função já achata toda a hierarquia
    — subgrupos como "Stunt"/"Pyramids" dentro de "Building" nunca
    viraram objetos próprios pro jurado, só o grupo de nível mais alto
    — não expandido nesta rodada, fora de escopo). `PresentationDetailCriterionView`
    (outra view, resultado/detalhe de apresentação) herda os campos
    automaticamente por `extends`, só precisou de um ajuste no literal
    que a constrói.
  - **`showScoreBands` (novo prop, default `false`) em
    `ScoringCriteriaGroups.tsx`** — liga TUDO desta feature (descrição
    clicável de grupo/critério, badge de faixa atual, slider) de uma
    vez só. Só os dois consumidores da própria folha do jurado
    (`EventLiveScoringPage.tsx` mobile e `EventLiveScoringDesktopView.tsx`)
    passam `showScoreBands` — **`HeadJudgeJudgeSheet.tsx` (Painel Head
    Judge) não recebe a prop, fica exatamente como estava antes**,
    pedido explícito do usuário, já que os 3 consumidores compartilham
    o mesmo componente.
  - **Ícone de descrição virou clicável de verdade** (antes só um
    `Info` com `aria-label` estático, sem interação) — novo componente
    `CriterionInfoPopover.tsx` (`Popover` do shadcn/Base UI). Usado em
    3 lugares: descrição do grupo, descrição do critério, descrição da
    faixa (`ScoreBand.description`, campo diferente da descrição do
    critério). **Bug de HTML inválido evitado, não corrigido depois**:
    o cabeçalho do grupo inteiro era um único `<button>` — colocar o
    ícone de popover DENTRO dele criaria botão aninhado (inválido, e o
    clique borbulharia pro toggle de expandir/recolher, mesma classe
    de bug já vista antes nesta sessão com dropdown dentro de card
    clicável). Corrigido de saída: quando o grupo tem descrição, o
    cabeçalho vira uma `<div>` com dois `<button>` irmãos (nome+ícone
    de completo / chevron) e o popover entre eles, em vez de um botão
    só; sem descrição, mantém o `<button>` único original, inalterado.
  - **Faixa atual embaixo de "Nota máxima"** — novo componente
    `CurrentBandBadge.tsx`: acha a faixa com `findMatchingBand`
    (`lib/scoreBands.ts`, mesmo critério de desempate documentado
    acima pra sobreposição — a de `min` mais baixo vence), mostra nome
    na cor da própria faixa + ícone de descrição da faixa (se houver).
    Aparece tanto no mobile quanto no desktop (o slider é um adicional
    no desktop, não substitui esta linha).
  - **Slider só no desktop** (`ScoreBandSlider.tsx`, novo): usa
    `@base-ui/react/slider` DIRETO (não o `ui/slider.tsx` genérico
    gerado pelo shadcn CLI, que não expõe as partes internas — Track/
    Thumb — pra customização de cor por faixa). Trilho colorido via
    `buildBandGradient` (`lib/scoreBands.ts`, novo): calcula os pontos
    de corte reais (todo `min`/`max` de toda faixa, não só os limites
    de uma faixa isolada) e monta um `linear-gradient` de **hard
    stops** (`cor X% X%`, sem transição) — necessário porque em trechos
    de sobreposição a faixa "vencedora" pode mudar no meio do
    intervalo de uma faixa perdedora, então samplear só nos boundaries
    de cada faixa isoladamente daria cor errada num sub-trecho. Nomes
    das faixas abaixo do trilho, posicionados por `%` do centro de
    cada faixa (`(min+max)/2 / maxScore`). Bidirecional **sem estado
    próprio**: slider e input numérico só leem/escrevem
    `scores[criterion.id]` (o mesmo estado já existente) via
    `onSetScore` — nenhum debounce novo, todo `onValueChange` do
    slider dispara `emitEvent` na hora, mesmo padrão já aceito pros
    botões +/-.
  - **`npx shadcn add slider`** rodado só pra trazer a dependência
    `@base-ui/react/slider` pro projeto (o arquivo gerado
    `ui/slider.tsx` em si não é usado por `ScoreBandSlider.tsx`, que
    importa o primitivo direto).
  - **Testado com um evento e template descartáveis criados só pra
    este teste** (não deu pra usar templates/categorias reais porque
    estão travados por estarem em uso — ver feature de trava — e criar
    um evento novo era mais simples que destravar um real): evento
    "[TESTE claude] scoring bands" com categoria/equipe/cronograma/
    jurado (a própria conta) montados via `fetch` direto, publicado e
    iniciado, confirmando na tela de verdade: os 3 popovers (grupo,
    critério, faixa) abrem com o texto certo e não desmontam/colapsam
    nada por engano; clicar no slider atualiza o input; digitar no
    input move o slider e troca a cor/nome da faixa mostrada; slider
    confirmado presente só no bloco desktop (`hidden lg:flex`) e
    ausente no bloco mobile (`lg:hidden`) via inspeção do DOM (os dois
    blocos sempre existem, só o CSS decide qual aparece). Evento e
    template de teste excluídos ao final.
  - **Incidente durante o teste, sem relação com o código**: a sessão
    do Chrome estava com impersonation ativa (herdada de teste anterior
    não relacionado) sem eu perceber antes de começar a criar os
    recursos de teste — o evento/template acabaram sendo criados pelo
    usuário impersonado ("Maria Souza"), não pelo admin real. Só
    percebido na hora de limpar (`DELETE` deu `403` pro admin de
    verdade). Limpeza final feita via SQL direto (`pg`), não pela API.
    Lição registrada em memória (`feedback_browser_testing_real_data.md`):
    checar `GET /users/me` antes de iniciar qualquer sequência de setup
    na aba do navegador, nunca assumir que a identidade da sessão
    continua a mesma de antes.

- **Ajuste no desktop, mesmo dia**: depois de ver a primeira versão, o
  usuário pediu pra simplificar a versão desktop — sem a linha
  compacta de nome+ícone da faixa (`CurrentBandBadge`) antes do
  slider, já que o slider (cor do trilho/polegar + nomes das faixas
  embaixo) já comunica isso sozinho. Em vez disso, a **descrição** da
  faixa atual (texto puro, sem ícone/clique) aparece direto embaixo do
  slider (`ScoreBandSlider.tsx`, novo parágrafo depois dos rótulos de
  nome de faixa). `CurrentBandBadge` continua no mobile exatamente
  como antes (não tem slider lá, então a linha compacta continua
  sendo a única forma de mostrar qual faixa está selecionada).
  - Também pedido: ver como fica numa súmula que tenha o painel de
    ilegalidade (`sheet.isLegalityJudge`) junto — testado atribuindo o
    papel especial `legality_judge` (`SpecialJudgeRole`) ao mesmo
    jurado de teste, além do critério com faixas. Confirmado via texto
    do DOM (mobile e desktop) que o painel "LEGALIDADE"/"DEDUÇÕES"
    aparece normalmente junto com a nova UI de faixas, sem conflito de
    layout — no desktop, a ordem final é: nome do critério → "Nota
    máxima" → slider com nomes das faixas → descrição da faixa atual →
    (resto da folha) → painel de legalidade/deduções.
  - Reconfirmado com nota real (19.1, dentro de "Excelente"): mobile
    mostra o badge "Excelente"; desktop mostra a descrição
    "Execução exemplar, sem falhas técnicas." embaixo do slider, sem
    nenhuma linha de nome/ícone antes dele.

- **Cenário de demonstração aplicado no evento real "Easy Judge Cup"
  (2026-07-27), a pedido do usuário.** Faixas de pontuação aplicadas
  via SQL direto (`ScoringCriterion.use_score_bands`/`score_bands`,
  templates travados por estarem em uso — ver feature de trava — não
  dava pra editar via API) em 12 critérios reais dos dois templates do
  evento: 5 de 20 pts e 7 de 10 pts, com os ranges e descrições exatos
  fornecidos pelo usuário (Insuficiente/Abaixo do Esperado/Bom-Muito
  bom/Excelente). Critérios com outro valor de pontos (25/40/5) ficaram
  sem faixa — a regra passada só cobria 20 e 10 pts, não dava pra
  inferir uma proporção pros demais sem instrução explícita. Também
  vinculada a jurada de ilegalidade já existente do evento ("Ana
  Silva", sem nenhum critério atribuído até então) ao item "Overall"
  (20 pts, com faixas), junto da jurada que já estava lá (Carla
  Nogueira) — pra gerar de propósito o cenário "mesmo critério com mais
  de um jurado" numa súmula que também tem o painel de legalidade.

- **Bug real descoberto por causa do cenário acima: nota de item com
  mais de um jurado não era uma média, era "o último evento grava por
  cima" (2026-07-27).** O usuário notou o problema ao ver o cenário
  criado ("mais de um jurado pode arbitrar o mesmo critério... o ideal
  seria que a nota final do item fosse a média das avaliações").
  Investigação confirmou: `ScoringService.computePresentationResult`
  (nota oficial da Página de Resultados/rankings) e
  `buildPresentationDetail` (drill-down do admin) construíam um
  `Map<criterionId, valor>` simples, iterando TODOS os `ScoreEvent` de
  todos os jurados em ordem de `clientCreatedAt` e só fazendo
  `.set(criterionId, event.value)` — sem nenhuma dimensão de jurado no
  map. Com dois jurados no mesmo critério, o resultado final usava só a
  nota de quem gravou o evento MAIS RECENTE, descartando a nota do
  outro jurado silenciosamente do total oficial — havia até um
  comentário do autor original dizendo que "dois jurados no mesmo
  critério não é um cenário real hoje", confirmando que isso nunca foi
  tratado de propósito.
  - **Corrigido**: novo método privado compartilhado
    `computeAverageScoreByCriterion(scoreEvents)` — constrói
    `Map<criterionId, Map<judgeParticipationId, valor>>` (última nota
    de CADA jurado por critério, não só a última geral), depois reduz
    pra `Map<criterionId, média>`. Usado tanto por
    `computePresentationResult` (total oficial) quanto por
    `buildPresentationDetail` (detalhe por critério) — mesma lógica,
    sem duplicação.
  - **Decisão de UX consultada com o usuário**: a súmula de detalhe
    (drill-down do admin/Programa, `PresentationNotesDetail.tsx`)
    passou a mostrar só o valor final (a média) por critério, **sem**
    listar jurado por jurado — usuário escolheu essa opção em vez de
    detalhar cada nota individual. Isso eliminou o conceito de "o
    jurado responsável" por critério nessa tela: campo `judgeName`
    removido de `PresentationDetailCriterionView`
    (backend)/`PresentationDetailCriterion` (frontend) e do JSX
    (`{criterion.judgeName}` — linha removida). **`legality.judgeName`
    e `notes[].judgeName` (comentários) não foram tocados** — nesses
    dois, um nome só faz sentido (papel de legalidade normalmente tem
    um jurado só; comentário já é naturalmente por jurado).
  - **`buildPresentationDetail` também parou de usar
    `judgeIdByLeaf.get(...judgeIds[0])`** (que pegava só o primeiro
    jurado da lista pra decidir se um critério "tinha responsável") —
    virou um `Set<string>` de critérios com pelo menos um jurado
    atribuído (`assignedLeafIds`), sem favorecer nenhum jurado
    específico.
  - **Não testado com nota de verdade dos dois jurados** (só o código
    revisado + typecheck): "Ana Silva" (a jurada de ilegalidade vinculada
    ao cenário acima) não tem login de verdade acessível nesta sessão, e
    inserir um `ScoreEvent` fake pra ela via SQL num evento real seria
    fabricar dado de nota de um jurado que nunca pontuou de verdade —
    dado sensível demais pra simular sem necessidade. Já existem eventos
    reais de Carla Nogueira nesse critério (0.1 até 3.1, teste anterior
    desta sessão); o usuário pode confirmar a média na prática fazendo
    Ana também lançar uma nota pro mesmo critério (via impersonation) e
    conferindo se o total na página de Resultados muda pra média das
    duas, não só a nota de quem gravou por último.

## Pendências resolvidas (2026-07-28)

Rodada fechando 5 pontas soltas que estavam registradas neste arquivo
(pedido explícito do usuário, com a tratativa de cada uma já definida
por ele antes de eu começar).

- **`JudgesService.create`/`linkUnclaimedJudgesByEmail` não separavam
  firstName/lastName no roster.** Corrigido: `create` agora faz split
  no primeiro espaço do `dto.name` (`splitDisplayName`, novo helper no
  arquivo); `linkUnclaimedJudgesByEmail` usa `user.firstName`/
  `user.lastName` reais (já vinham separados, só não eram usados
  assim). Testado via `fetch` real (`POST .../judges` com "Roberto
  Carlos Souza" → `firstName: "Roberto"`, `lastName: "Carlos Souza"` no
  roster) e limpo depois.
- **Média de nota multi-jurado testada com nota real via
  impersonation** (fix já existia, só faltava o teste end-to-end
  prometido). Impersonei Carla Nogueira (além de Ana Silva, já
  impersonada) e lancei uma nota real (8) no critério "Overall" de uma
  apresentação onde Ana já tinha 12 — o valor consolidado virou **10**
  (a média, não a última nota gravada), confirmando
  `computeAverageScoreByCriterion` funcionando em produção local, não
  só em código.
- **Descrição de subgrupos intermediários agora chega no jurado.**
  `ScoringCriterionView`/`PresentationDetailCriterionView` (backend,
  `scoring.service.ts`) ganharam `subgroupDescriptions: {name,
  description}[]` — `buildGroups` continua achatando a árvore em 2
  níveis (grupo-raiz → item, de propósito), mas agora coleta a
  descrição de cada subgrupo no caminho até a raiz (ex: "Stunt"/
  "Pyramids" dentro de "Building") e devolve pro item folha. Frontend
  (`ScoringCriteriaGroups.tsx`) renderiza um `CriterionInfoPopover` por
  subgrupo com descrição, ao lado do nome do item — só quando
  `showScoreBands` (mesmo gate do resto da feature). Testado inserindo
  um subgrupo temporário via SQL direto (não dava pra criar
  subgrupo aninhado pela API — o builder só expõe 2 níveis), revertido
  depois.
- **Faixas de pontuação desatualizadas após mudar `maxScore` — bug
  real encontrado no caminho, mais grave que a lacuna original.**
  Investigando isso descobri que `ScoringCriteriaService.update`
  fazia `Object.assign(criterion, { ...rawPatch, scoreBands:
  this.normalizeBands(rawPatch.scoreBands) })` **incondicionalmente**
  — `normalizeBands(undefined)` devolve `undefined`, mas a CHAVE
  `scoreBands` ficava presente no objeto do patch mesmo assim, então
  `Object.assign` apagava `criterion.scoreBands` em memória em
  QUALQUER update (ex: só mudar o nome ou o `maxScore`). O TypeORM
  `save()` ignora coluna `undefined` (o banco não era afetado — dado
  real nunca foi perdido), mas a entidade retornada na resposta HTTP
  tinha `scoreBands: undefined`, que `JSON.stringify` omite — o
  builder lia a ausência da chave como "sem faixas" e mostrava a lista
  vazia até um reload. Corrigido: `scoreBands` só entra no patch
  quando `rawPatch.scoreBands !== undefined` (payload realmente o
  inclui). Confirmado via Postgres direto que o dado sempre esteve
  íntegro no banco, só a resposta/exibição imediata é que mentia.
  Com isso corrigido, a tratativa pedida pelo usuário: `ScoringTemplatesService`
  ganhou `hasStaleScoreBands`/`bandsCoverMaxScore` (mesmo algoritmo de
  sweep de `assertBandsCoverMaxScore`, sem lançar exceção) — dobra em
  `isComplete` (`findAllForUser`, junto de `distributedScore`/
  `hasEmptyGroup`) e em `assertUsableTemplate` (bloqueia vincular um
  template com faixas desatualizadas a uma categoria, `409` com
  mensagem própria). Frontend: `lib/scoreBands.ts` ganhou
  `hasStaleScoreBands` (mesma lógica, via `validateScoreBands` já
  existente) usado num banner âmbar novo no topo do
  `ScoringTemplateBuilderPage` (mesmo estilo do banner de `isLocked`) —
  o aviso POR CRITÉRIO já existia de graça (era o próprio bug acima que
  mascarava): `ScoreBandsEditor` já recalcula `validateScoreBands(bands,
  maxScore)` a cada render a partir de `bandsDraft`/`maxScore` (estado
  local do painel), então corrigir o bug de resposta já fez esse aviso
  aparecer sozinho. Testado com um template descartável: reduzir
  `maxScore` abaixo da cobertura das faixas (via update real, mudando só
  `maxScore`) fez aparecer o banner do topo + a mensagem "As faixas
  precisam cobrir até X..." no painel, com as faixas salvas continuando
  visíveis (não mais somem); confirmado por `fetch` direto que
  `isComplete: false` mesmo com `distributedScore === targetScore`
  (isolado só pela banda desatualizada, via um cenário com bandas
  editadas direto no Postgres pra não disparar a validação de escrita).
- **Processo Node antigo (`dist/src/main`) da sessão anterior**: não
  existe mais — só o processo do próprio `nest start --watch` desta
  sessão está na porta 3000 (verificado via `/proc/net/tcp`+`/proc/*/fd`).
  Nada a remover.

## Tempo real (Socket.io self-hosted) no painel "evento ao vivo" (2026-07-28)

Fecha o item 1 antigo de "Próximos passos" — decidido com o usuário
(perguntou sobre custo de Socket.io self-hosted vs. Supabase Realtime;
resposta: os dois são de graça, mas Socket.io não amarra a escolha
futura de Postgres de produção — Neon vs. Supabase — a essa decisão, já
que Realtime só existiria de graça se o Postgres também fosse
Supabase). Plano completo em `EnterPlanMode`/`ExitPlanMode` desta
sessão (explorado com 2 agentes Explore em paralelo, backend+frontend,
antes de desenhar).

- **Padrão escolhido: "sinal, não payload".** O socket só avisa "algo
  mudou" (tipo do sinal + `aliasId`); quem recebe refaz a MESMA chamada
  REST que o polling antigo já fazia — zero duplicação de lógica de
  serialização entre REST e WS. Os `setInterval` de polling continuam
  existindo como rede de segurança (`REALTIME_FALLBACK_POLL_MS`,
  `apps/web/src/lib/useEventLiveSocket.ts` — 2min, era 30s), pro caso
  de reconexão de socket falhar silenciosamente — mesmo espírito do
  buffer IndexedDB do scoring, nunca depender de uma via só.
- **Sem `EventEmitter2` no projeto até então** (confirmado por grep
  amplo) — todo efeito colateral sempre foi chamada direta. Injetar o
  Gateway direto em `NotificationsService`/`EventsService` criaria
  import circular (mesmo tipo que o projeto já evita sistematicamente
  importando só o repositório necessário em vez do módulo inteiro).
  `EventEmitterModule.forRoot()` registrado global em `app.module.ts`
  resolve isso de graça — services emitem sem saber que WebSocket
  existe.
- **Ponto único de emissão**: `NotificationsService.create()`
  (`apps/api/src/notifications/services/notifications.service.ts:45-72`)
  já é o funil por onde passam TODAS as notificações do sistema
  (apresentação movida/concluída/desistência, contestação, liberação de
  súmulas/resultado) — um `eventEmitter.emit('notification.created',
  {...})` logo após o `save()` cobriu todos esses gatilhos de uma vez,
  sem tocar nos ~6 call sites espalhados em
  `schedule`/`scoring`/`events`. Único gap real: `publishEvent`/
  `startEvent`/`completeEvent`/`unpublishEvent`
  (`events.service.ts`) não passavam por notificação nenhuma — ganharam
  um `emit('event.status_changed', { aliasId, status })` cada.
- **Novo módulo `apps/api/src/realtime/`** (`realtime.module.ts` +
  `events.gateway.ts`, `EventsGateway`): autenticação própria no
  handshake (não dá pra reaproveitar `JwtAuthGuard`, que é `CanActivate`
  amarrado a `ExecutionContext.switchToHttp()`/Passport) — lê
  `client.handshake.auth.token`, valida na mão com `JwtService.verify`
  + mesmo `JWT_SECRET` de `jwt.strategy.ts`. Sala por evento
  (`event:{aliasId}`) via mensagens `join`/`leave` do cliente — o
  gateway confere membership consultando `EventMember` **direto** (repo
  próprio, mesmo padrão de `NotificationsModule`), sem importar
  `EventsModule` (evita o mesmo tipo de ciclo).
- **Frontend**: `apps/web/src/lib/socket.ts` (`createEventSocket`,
  conecta em `/api/socket.io` — mesmo prefixo do proxy `/api` já usado
  por toda chamada REST, sem hardcode de `localhost:3000`) +
  `useEventLiveSocket(aliasId, handlers)` (conexão por
  componente/página, não singleton global — mais simples numa POC,
  custo é reconectar ao trocar de subpágina do mesmo evento). `vite.config.ts`
  ganhou `ws: true` na entrada `/api` já existente (upgrade de conexão
  não é encaminhado pelo proxy por padrão).
- **4 páginas ligadas** (`EventLiveDashboardPage`, `EventLiveSchedulePage`,
  `EventLiveNotificationsPage`, `EventLiveResultsPage`) — qualquer
  `notification.created` recarrega os dados relevantes daquela tela
  (mais simples e barato o bastante numa POC do que filtrar por tipo);
  `event.status_changed` recarrega o `Event` (badge de status/"Ao vivo"
  atualiza sem reload). **Fora de escopo, deliberadamente**: a tela de
  lançamento de nota do jurado e a visão do programa continuam do jeito
  que estão — o requisito não-negociável "notas nunca podem ser
  perdidas" significa que o caminho de escrita (POST HTTP + buffer
  IndexedDB + `ScoreEvent` append-only) não devia ser tocado nesta
  rodada.
- **Testado ponta a ponta com evento descartável** (criado, publicado,
  jurado de teste adicionado ao roster, testado, excluído — nunca em
  cima de dado real): (1) protocolo puro via `socket.io-client` num
  script Node conectando com o JWT de um jurado real, confirmando
  `event.status_changed` (disparado por `POST .../start`) e
  `notification.created` (disparado por liberar súmulas,
  `PATCH .../scoring/admin/release`) chegando corretamente na sala; (2)
  ponta a ponta pelo app de verdade — com a aba do jurado aberta na tela
  "Início" do evento de teste, concluir o evento via outra sessão
  (`POST .../complete`) fez a aba do jurado **navegar sozinha pra Home**
  (reagindo ao `useEffect` que já redireciona quando `status ===
  "completed"`), sem nenhum reload manual — prova que o sinal atravessa
  proxy do Vite → gateway → `EventEmitter2` → hook → estado React
  corretamente.

## Maior nota por critério na súmula do jurado (2026-07-28)

Indicador de comparação entre equipes na tela de lançamento de nota:
pra cada item de avaliação, qual equipe tem a maior nota até agora,
comparando só com outras apresentações da MESMA categoria (mesmo
sistema de pontuação — comparar entre categorias diferentes não faria
sentido, confirmado com o usuário antes de implementar). Mobile mostra
texto; desktop só marca no slider (pedido explícito do usuário: "tomar
cuidado pra não poluir a tela").

- **Backend**: `ScoringService.getCriterionLeaders(categoryId,
  criterionIds)` (novo, privado) — busca todas as `ScheduleEntry` tipo
  `presentation` da categoria (exclui desistências, `withdrawnAt IS
  NOT NULL`), os `Team` e `ScoreEvent` delas numa query em lote cada,
  reusa **`computeAverageScoreByCriterion`** (o mesmo método privado já
  existente do fix de média multi-jurado) pra obter a nota de cada
  apresentação por critério, agrega pelo maior valor e quais equipes
  empataram nele. Chamado dentro de `getSheet`, resultado anexado em
  cada `ScoringCriterionView.bestScore` (`{ value, teamNames } | null`,
  novo campo — `buildGroups` sempre inicializa como `null`, só
  `getSheet` de fato sobrescreve; `getSheetForJudge`/Head Judge e
  `buildPresentationDetail` deixam `null` de propósito, a feature é só
  da folha do próprio jurado). Precisou registrar `ScheduleEntry` no
  `TypeOrmModule.forFeature` de `scoring.module.ts` (repo direto, mesmo
  padrão já usado ali pra `Category`/`Team` — evita depender de método
  novo em `ScheduleService`).
  - **Empate por arredondamento, não igualdade direta**:
    `ScoreEvent.value` é `float` (double precision) e a MÉDIA de vários
    jurados pode gerar ruído de arredondamento binário — comparação
    arredonda pra 1 casa decimal (`Math.round(v * 10) / 10`, mesma
    precisão já exibida na UI) antes de agrupar por valor, senão um
    empate real podia não ser detectado.
  - Equipe da própria apresentação sendo pontuada entra na comparação
    normalmente (não há razão pra excluí-la).
- **Frontend**: `ScoringCriteriaGroups.tsx`, mesmo gate `showScoreBands`
  já usado pelo resto da feature de faixas (Head Judge nunca recebe
  `true`, então nunca vê isso). Mobile: "Maior nota: 12.0 (Equipe B)"
  quando só uma equipe lidera; quando 2+ empatadas, vira "Maior nota:
  12.0" + linha separada "Mesma nota atribuída às equipes X, Y" — só
  aparece quando a condição é verdadeira (nada renderiza se
  `bestScore` for `null`). Desktop: `ScoreBandSlider.tsx` ganhou prop
  `bestScore` opcional — marcador `Trophy` (lucide, âmbar, cor
  deliberadamente diferente das cores de faixa) posicionado por
  `left: (value/maxScore)*100%`, ACIMA do trilho (os nomes de faixa já
  ocupam a linha de baixo) — nome(s) da(s) equipe(s) só aparece(m) num
  rótulo no hover, padrão CSS `group`/`group-hover:opacity-100` já
  usado no projeto (sem lib de tooltip nova).
- **Testado com evento/template/categoria/3 equipes descartáveis**
  (criados e apagados só pra este teste, nunca em cima de dado real):
  cenário 1 (Equipe B=12, sozinha na frente) → `bestScore: {value: 12,
  teamNames: ["Equipe B"]}`, confirmado na tela ("Maior nota: 12.0
  (Equipe B)"); cenário 2 (Equipe C também lançada em 12, empatando com
  B) → `bestScore: {value: 12, teamNames: ["Equipe B", "Equipe C"]}`,
  confirmado na tela (linha de empate apareceu). Desktop confirmado via
  DOM: exatamente 1 ícone `Trophy` renderizado (só no bloco desktop,
  `showSlider` já é `!isMobile`), posicionado em `left: 60%` (12/20),
  tooltip com o nome da equipe líder.

## Rebrand pra "Cheer Cup" (2026-07-30)

Decisão do usuário: a marca visível pro usuário final virou **"Cheer
Cup"** — o produto cresceu além do escopo "julgamento" (programa,
atleta e espectador são papéis reais hoje, não só jurado/produtor).
Pasta do projeto, nome do repositório/pacotes npm (`easyjudge`) e o
evento de teste descartável ("Easy Judge Cup") continuam com o nome
antigo **de propósito** — só a marca voltada pro usuário mudou.

- **O que mudou**: `apps/web/public/logo.png`/`favicon.png` (arte nova
  fornecida pelo usuário), `<title>` (`index.html`), `alt` do logo
  (`LoginPage.tsx`), nome do remetente + assunto do email de
  verificação (`mail.service.ts`), e o texto da sidebar/menu mobile
  (`MobileNavSheet.tsx`, componente `BrandMark`) — esse último não
  apareceu num primeiro grep por `"easyJudge"` porque estava partido em
  JSX (`easy<span>Judge</span>`), vale lembrar desse padrão se sobrar
  algum texto de marca esquecido.
- **O que ficou de propósito com o nome antigo**: pasta/repo/
  `package.json` (`easyjudge`), o evento de teste "Easy Judge Cup", e
  identificadores internos sem exposição nenhuma ao usuário — chaves de
  `localStorage` (`easyjudge-auth`, `easyjudge-pending-join-code`) e o
  nome do banco `IndexedDB` (`easyjudge-score-events`); trocar essas
  quebraria sessão/buffer de nota já em cache de quem já usa o app, sem
  ganho nenhum visível. Este próprio arquivo (`CLAUDE.md`) também
  continua chamando o projeto de "easyJudge" — é identidade interna de
  projeto, não a marca do cliente.
- **Logo da tela de login** ganhou `rounded-full` + tamanho reduzido
  (`max-w-[150px]`, `short:max-w-[100px]`, era `220px`/`130px`) — a arte
  nova é um selo quadrado, não um wordmark horizontal como a anterior.
- A conta do Resend também mudou de dono no meio da sessão (de
  `easyjudgepro@gmail.com` pra `cheercupapp@gmail.com`) —
  `EMAIL_OVERRIDE_TO` no `.env` acompanhou até ser removido de vez (ver
  seção de deploy abaixo).

## Deploy de produção — domínio, banco, storage, backend, frontend (2026-07-30/31)

Primeira vez que o projeto sai do ambiente local pra produção de
verdade. Domínio `cheercup.com.br` registrado no Registro.br, DNS
movido pra **Cloudflare** (plano Free) no mesmo dia — decisão do
usuário de usar o ecossistema Cloudflare como base (DNS, R2 pro
storage, Workers pro frontend). Guiado etapa por etapa, com o usuário
confirmando cada ação em conta externa (criação de conta/pagamento não
é algo que dá pra fazer sozinho).

1. **Email (Resend) com domínio verificado.** DNS: MX+SPF em
   `send.cheercup.com.br`, DKIM em `resend._domainkey.cheercup.com.br`,
   e um "null MX" (`MX .`) + SPF restritivo (`v=spf1 -all`) + DMARC
   (`p=reject`) no domínio raiz — esse trio é hardening recomendado
   pelo próprio Resend (impede spoofing do domínio raiz, já que o envio
   de verdade passa pelo subdomínio `send.`), não é obrigatório pra
   verificação em si mas o painel já sugere. Todos os registros como
   "DNS only" (nuvem cinza) no Cloudflare — o proxy atrapalharia a
   verificação. Resultado: `EMAIL_FROM=Cheer Cup <no-reply@cheercup.com.br>`
   e **`EMAIL_OVERRIDE_TO` removido** do `.env` — cada cadastro volta a
   receber o próprio email de verificação (antes, o sandbox
   `onboarding@resend.dev` forçava tudo pra uma caixa só).
2. **Postgres de produção (Neon).** Projeto criado pelo usuário, as 57
   migrations do TypeORM rodadas contra ele com sucesso (schema só,
   banco vazio — é lançamento novo, não migração de dado do local). **A
   `DATABASE_URL` do Neon nunca foi persistida em arquivo nenhum** (nem
   `.env`, nem memória) — usada só via variável de ambiente inline na
   hora das migrations, de propósito: o `.env` local continua apontando
   pro Postgres do Docker, pra nenhum teste local acidentalmente bater
   no banco de produção.
3. **Storage (Cloudflare R2)**, substituindo o disco local (`uploads/`)
   que só funcionaria com host de backend com disco persistente. Bucket
   `cheercup-uploads`, domínio público `cdn.cheercup.com.br`. Novo
   `StorageService` (`apps/api/src/common/services/storage.service.ts`,
   via `CommonModule` global novo) — usa `@aws-sdk/client-s3` (R2 é
   S3-compatible) quando as credenciais `R2_*` estão no `.env`, **cai
   pro disco local senão** — mesmo padrão configured-service-or-stub já
   usado pelo `MailService` com o Resend, então dev local sem
   credencial R2 continua funcionando normalmente. Os 3 pontos de
   upload (`EventsService.setEventLogo`, `ProgramsService.setLogo`,
   `RegulationsService.uploadDocument`) passaram a chamar
   `storageService.upload(file, folder)`; os multer configs
   (`logo-upload.config.ts`/`document-upload.config.ts`) trocaram
   `diskStorage` por `memoryStorage` pra popular `file.buffer`.
   Diferente da `DATABASE_URL` do Neon, as credenciais R2 **foram**
   persistidas no `.env` local (mesmo raciocínio do `RESEND_API_KEY`:
   dev local já fala com o serviço de verdade, não um stand-in). Sem
   mudança nenhuma no frontend — `logoUrl`/`fileUrl` já eram usados
   como valor opaco de `<img src>`/`window.open`, funcionam igual sendo
   relativos ou absolutos.
   - **Gotcha**: o formulário "Add Custom Domain" do R2 recusou
     `cdn.cheercup.com.br` na primeira tentativa ("Domain format is
     invalid" — suspeita de bug de validação com TLD composto tipo
     `.com.br`); redigitar o domínio (sem colar) numa segunda tentativa
     resolveu. Vale tentar de novo antes de assumir que travou, se
     outro domínio dessa zona der o mesmo erro.
4. **Backend (Render, plano Free)**, publicado em
   `https://cheercup-api.onrender.com` — decisão consciente do usuário
   de aceitar o cold-start do plano grátis (~50s depois de 15min
   parado) por enquanto. **Precisa migrar pro plano pago (Starter,
   ~$7/mês) ou outro host sempre-ligado antes de qualquer competição
   real rodar em cima disso** — não deixar escapar.
   - **Bug real achado e corrigido**: `apps/api/package.json` tinha
     `"start:prod": "node dist/main"`, mas o build (`nest build`) na
     verdade gera `dist/src/main.js`, não `dist/main.js` — o
     `tsconfig.json` inclui `data-source.ts` (fora de `src/`) junto dos
     arquivos de `src/`, então o TypeScript infere a raiz comum como
     `apps/api/` inteiro, replicando a subpasta `src/` dentro do
     `dist/`. Esse script nunca tinha sido exercitado antes (produção
     nunca tinha existido). Corrigido no `package.json` — **mas o campo
     "Start Command" do Render é um valor próprio, gravado na criação
     do serviço, que não se atualiza sozinho a partir do
     `package.json`** mesmo depois de commitar a correção — precisou
     editar manualmente no painel também. Vale lembrar desse padrão
     ("campo de dashboard seedado de um script, mas não sincronizado
     com ele depois") em qualquer outro host que já tenha sido
     configurado uma vez.
5. **Frontend (Cloudflare Workers com "static assets")** — não é o
   Pages clássico (Git integration antiga); essa conta cai no fluxo
   novo unificado de Workers, publica via Wrangler. Publicado em
   `https://cheercup-web.fhomaia.workers.dev`. Novo `wrangler.jsonc` na
   raiz do repo: `{ name: "cheercup-web", assets: { directory:
   "./apps/web/dist", not_found_handling: "single-page-application" } }`
   — esse `not_found_handling` é quem resolve o fallback de SPA (rota
   client-side do React Router) nativamente nesse modelo.
   - **Gotcha**: um arquivo `apps/web/public/_redirects`
     (`/* /index.html 200`, criado antes por engano assumindo o fluxo
     clássico do Pages) **conflita** com o `not_found_handling` acima —
     o validador do Cloudflare recusou o deploy por "loop de
     redirecionamento infinito". Removido; se o projeto algum dia
     voltar pro Pages clássico via Git integration, o `_redirects`
     precisaria voltar (e o `wrangler.jsonc` não se aplicaria mais).
   - **Mudança de código necessária**: `apps/web/src/api/client.ts` e
     `apps/web/src/lib/socket.ts` tinham `/api` relativo fixo, que só
     funciona via proxy do Vite em dev (same-origin) — não existe proxy
     de servidor num build estático. Os dois agora leem
     `import.meta.env.VITE_API_URL` (`client.ts` exporta `API_URL` pra
     `socket.ts` reusar a mesma decisão), caindo pro comportamento
     antigo quando a variável não está definida — dev local não
     precisou de nenhum `.env` novo. Variável de build no Cloudflare:
     `VITE_API_URL=https://api.cheercup.com.br` — **de propósito
     deixada sem criptografar** (botão "Encrypt" do painel), já que o
     Vite grava o valor dentro do JS baixado pelo navegador de qualquer
     jeito; criptografar só dificultaria editar depois, sem ganho de
     segurança nenhum.
6. **Domínio próprio nos dois lados**: `cheercup.com.br` (raiz, sem
   subdomínio) → Worker; `api.cheercup.com.br` → Render via CNAME.
   **Gotcha**: o registro CNAME do backend precisou ficar "DNS only"
   (nuvem cinza) no Cloudflare — com "Proxied" (nuvem laranja) o
   certificado TLS do próprio Render nunca saía de "Pending", porque o
   Cloudflare intercepta a validação antes de chegar no Render.
7. **CORS restrito**: `app.enableCors()` (liberava qualquer origem)
   virou `app.enableCors({ origin: ['https://cheercup.com.br',
   'https://cheercup-web.fhomaia.workers.dev'] })` em `main.ts` —
   testado via `curl` com header `Origin` de um domínio não autorizado
   (sem `access-control-allow-origin` na resposta, bloqueado) e do
   domínio de produção (header presente, liberado).

**Testado ponta a ponta pelo navegador nos domínios finais** (não só
cada peça isolada): formulário de login em `cheercup.com.br`, envio de
credencial errada disparou `POST https://api.cheercup.com.br/auth/login`
cross-origin sem erro de CORS, mensagem de erro certa na tela —
confirma a cadeia inteira (Workers → Render → Neon) funcionando junta.

**Pontas soltas conscientes**: Render Free em cold-start (ver item 4
acima), sem `www.cheercup.com.br` configurado (só o domínio raiz), e o
bundle do frontend passou de 2MB/500KB recomendado (aviso do próprio
Vite no build, `apps/web/dist/assets/index-*.js` ~636KB gzipped —
corrigir exigiria code-splitting por rota com `React.lazy`/`Suspense`,
não tentado). Nenhuma das três bloqueia uso, registradas como
pendência.

## Ajustes no cadastro por papel + identidade visual do email de verificação (2026-07-31)

Rodada de ajustes pedidos direto na tela de cadastro (`RegisterDialog.tsx`)
e no email de código de verificação, um de cada vez, mesma sessão.

- **Atleta não pede mais "equipe/instituição"** — `isStepApplicable`
  (`RegisterDialog.tsx`) passou a pular a etapa `"team"` também pra
  `role === "athlete"` (antes só pulava pra `"spectator"`, que por trás
  já é `athlete` — ver `SIGNUP_ROLE_ORDER`). Justificativa do usuário: o
  email do programa (etapa `"programEmail"`, que continua existindo só
  pra atleta) já é suficiente pra iniciar o vínculo — perguntar as duas
  coisas era redundante.
- **Documento de atleta/espectador virou CPF-only e opcional** — antes
  era CPF/CNPJ obrigatório pra todo papel, sem exceção. Agora, só pra
  `role === "athlete"` (inclui espectador): a UI esconde o seletor
  CPF/CNPJ (só mostra campo de CPF) e o passo vira pulável ("Pular",
  mesmo padrão do passo de equipe). Documento continua obrigatório
  (CPF ou CNPJ) pra todo o resto.
  - **Backend, 4 camadas**: `RegisterDto.documentType`/`documentNumber`
    viraram opcionais com `@ValidateIf` condicionado a
    `role !== ATHLETE || <campo irmão presente>` (mesmo campo continua
    obrigatório demais papéis). `AuthService.register` reforça "só CPF"
    pra atleta (`400` se `documentType === CNPJ` com `role === ATHLETE`)
    — defesa em profundidade, já que a UI só oferece CPF pra esse papel,
    mas a API pode ser chamada direto. `User.documentType`/
    `documentNumber` viraram `nullable: true` (índice único do
    `document_number` continua funcionando — Postgres trata cada `NULL`
    como distinto). `UsersService.createPendingUser` só roda a checagem
    de documento duplicado quando `documentNumber` de fato veio
    preenchido (senão a query bateria em qualquer linha sem documento).
  - **Gotcha reencontrado** (já documentado antes neste arquivo, seção
    "Gotchas"): `documentNumber: string | null` sem `type: 'varchar'`
    explícito no `@Column()` quebrou a migration com
    `DataTypeNotSupportedError` — TypeORM não infere o tipo via
    reflection quando a coluna é `union | null`. Corrigido adicionando
    `type: 'varchar'`.
  - Migration `MakeUserDocumentOptional` (`ALTER COLUMN ... DROP NOT
    NULL` nas duas colunas) rodada com sucesso no Postgres local.
- **Rótulo "Programa" virou "Programa/Ginásio"** — só cosmético,
  `ROLE_LABELS.program` em `apps/web/src/lib/roleLabels.ts` (usado tanto
  no seletor de papel do cadastro quanto em qualquer lugar que exiba o
  nome do papel).
- **Cadastro de programa/ginásio simplificado**: além de "equipe/
  instituição" (redundante — o nome do próprio programa já é
  perguntado), a etapa "sobrenome" também não faz sentido pra uma
  instituição. `isStepApplicable` pula `"lastName"` (além de `"team"`)
  pra `role === "program"`; a etapa `"firstName"` muda de pergunta pra
  esse papel ("Qual o nome do seu programa/ginásio?" em vez de "Qual é o
  seu nome?"). Backend: `RegisterDto.lastName` ganhou o mesmo padrão de
  `@ValidateIf` (obrigatório pra todo papel, exceto `PROGRAM`);
  `UsersService.createPendingUser` grava `dto.lastName ?? ''` (nunca
  `undefined`, já que a coluna `last_name` continua `NOT NULL` — não
  precisou de migration, string vazia já satisfaz).
  - **Efeito colateral corrigido**: com `lastName` virando `""` de
    verdade pra programa (não só em teoria), toda concatenação direta
    `${firstName} ${lastName}` (sem `.trim()`) passou a deixar um espaço
    sobrando visível. Backend: `ProgramsService` ganhou
    `buildUserDisplayName(user)` (usa só `firstName` quando `lastName`
    é vazio), substituindo as 5 ocorrências que serviam de fallback pro
    nome de exibição do programa quando `teamOrInstitutionName` não
    está preenchido — o que agora é o caso de TODO programa novo, já
    que a etapa "team" também foi removida pra esse papel (antes era só
    um fallback de borda). Frontend: `.trim()` acrescentado nos 4 pontos
    que já concatenavam `firstName`/`lastName` pra exibição
    (`AppSidebar.tsx`, `MobileNavSheet.tsx`, `ImpersonateDialog.tsx`,
    resumo do próprio `RegisterDialog.tsx`) — sem esse ajuste, um
    programa cadastrado depois desta mudança apareceria como "Escola
    XYZ " (espaço sobrando) na sidebar/impersonation.
  - **Testado via curl direto** (servidor local, depois revertido — as
    3 linhas de teste, incluindo um CPF válido gerado com
    `cpf.generate()`, foram apagadas do Postgres local ao final):
    atleta sem documento → criado com `document_type`/`document_number`
    `NULL`; atleta com `documentType: cnpj` → `400` "Atletas só podem
    informar CPF."; programa sem `lastName` no payload → criado com
    `last_name` `''`; jurado sem documento → `400` de validação (regra
    antiga intacta pros demais papéis).
- **Email de verificação ganhou identidade visual** — antes era HTML
  solto (`<p>` sem estilo nenhum), sem logo/cor. `MailService` ganhou
  `buildVerificationEmailHtml(code, testRecipientEmail)`: layout em
  tabela (não `<style>` em `<head>` — Outlook desktop ignora CSS fora de
  atributo `style` inline, então todo estilo é inline de propósito),
  logo circular no topo sobre faixa navy (`#14293d`, mesma paleta de
  `apps/web/src/index.css`), código em destaque grande/monoespaçado
  dentro de uma caixa amarelo-clara com borda `#f7a828`. Logo referenciado
  por URL pública fixa (`https://cheercup.com.br/logo.png`, não uma env
  var) — o cliente de email de quem recebe busca a imagem de fora, nunca
  resolveria `localhost`, então não faz sentido essa URL variar por
  ambiente como o resto do app faz. O banner de "cadastro de teste"
  (usado só se `EMAIL_OVERRIDE_TO` estiver setado — hoje não está, ver
  seção de deploy) ganhou o mesmo tratamento visual, dentro do mesmo
  template.
  - **Testado enviando um email de verdade** (servidor local, Resend de
    produção — `RESEND_API_KEY` do `.env` local já aponta pro domínio
    verificado) pra um alias `+` do próprio email do usuário (não uma
    conta nova real — evita qualquer risco de mexer em cadastro
    existente), confirmado visualmente por ele que o layout ficou bom;
    o registro de teste foi apagado do Postgres local depois.

## Data de nascimento, consentimento de Termos/Privacidade e bloqueio de menores no cadastro (2026-07-31)

Rodada final de ajustes de cadastro desta sessão, encadeada com a de cima
— fechada depois de eu ter recomendado (só em conversa, não implementado
ainda) considerar um checkbox de aceite por LGPD.

- **Campo "data de nascimento"**: novo passo `"birthDate"` no
  `RegisterDialog`, só perguntado pra quem usa CPF (uma instituição com
  CNPJ não tem data de nascimento) — `DatePicker.tsx` ganhou
  `captionLayout`/`startMonth`/`endMonth`/`maxDate` (repassados pro
  `Calendar` do shadcn/react-day-picker) especificamente pra viabilizar
  esse caso (navegar até ~100 anos atrás mês a mês seria inviável; com
  `captionLayout="dropdown"` dá pra pular direto pro ano). Pra
  atleta/espectador (só aceitam CPF) o passo **sempre** aparece, mesmo
  que o CPF em si tenha sido pulado (documento é opcional pra esse
  papel, mas quando informado é sempre CPF — não fazia sentido
  condicionar um ao outro). `User.birthDate` (`type: 'date'`, nullable)
  + migration `AddBirthDateToUsers`; `RegisterDto.birthDate` obrigatório
  via `@ValidateIf` quando `documentType === CPF` OU `role ===
  ATHLETE`; validação de "não pode ser no futuro" em
  `AuthService.register` (`IsDateString` só confere formato).
- **Restrição temporária: só maiores de 18 anos** (pedido do usuário,
  depois de eu ter perguntado sobre consentimento de responsável legal
  pra menores — LGPD art. 14 — como parte da recomendação de checkbox
  de Termos/Privacidade). Decisão consciente do usuário de simplificar
  por enquanto, mesmo sabendo que atletas de cheerleading são
  frequentemente menores de idade — **isso bloqueia esse público de
  criar a PRÓPRIA conta** (mas não impede um programa de cadastrar um
  atleta menor no roster via `AthleteLink`, sem conta própria — só
  quem quer logar e ver a própria nota precisa de conta, e essa conta
  hoje exige 18+). `DatePicker` do passo `"birthDate"` usa
  `getMaxBirthDate()` (hoje − 18 anos) como `endMonth`/`maxDate` — o
  calendário fisicamente não deixa selecionar uma data mais recente, é
  a defesa principal (não precisa de mensagem de erro, a UI já
  impede). Reforçado em `AuthService.register` com a mesma conta de
  data (`BadRequestException` dedicado, mensagem "É necessário ter 18
  anos ou mais para se cadastrar."). **Ponta solta consciente**: essa é
  uma decisão de produto bem restritiva pro público real da
  plataforma — o próprio nome do arquivo já registra "por enquanto";
  não remover essa trava sem decisão explícita do usuário, e ela vai
  precisar ser revisitada (com o fluxo de consentimento de responsável
  legal implementado de verdade) antes da plataforma ser considerada
  pronta pra atletas menores se autocadastrarem.
- **Checkbox de aceite de Termos de Uso/Política de Privacidade**,
  implementado depois que o usuário pediu explicitamente (eu tinha só
  recomendado em conversa antes, sem implementar). Novo passo final:
  checkbox obrigatório no passo `"summary"` (não um passo próprio —
  fica junto da revisão final, antes do botão "Confirmar e criar
  conta", que fica desabilitado até marcar). Duas páginas novas,
  públicas (fora de `GuestRoute`/`ProtectedRoute`, mesmo raciocínio de
  `/join/:code` — precisam abrir de dentro do popup de cadastro
  deslogado, mas continuam acessíveis logado): `/terms`
  (`TermsOfUsePage.tsx`) e `/privacy` (`PrivacyPolicyPage.tsx`), linkadas
  com `target="_blank"` (não perde o progresso do cadastro no popup).
  Conteúdo é um rascunho razoável escrito com base no que a plataforma
  de fato coleta/trata (não é texto genérico de template) — **não é
  revisão jurídica**, só a implementação técnica do consentimento;
  avisei o usuário em conversa (não no texto da página) que vale
  revisão de advogado antes de operar com dado real de menores/maiores
  em produção de verdade.
  - **Backend**: `RegisterDto.acceptedTerms: boolean` com `@Equals(true)`
    (não `@IsBoolean`, de propósito — `false` explícito também precisa
    ser rejeitado, não só ausência do campo) — `409`/`400` desde a
    validação do DTO, nunca chega no service com valor errado.
    `User.termsAcceptedAt` (timestamptz, nullable — nulo só pra contas
    criadas antes desta mudança, sem backfill possível) gravado com
    `new Date()` em `UsersService.createPendingUser`, registro de
    auditoria do aceite. Migration `AddTermsAcceptedAtToUsers`.
  - **`RegisterPayload.acceptedTerms`** (frontend, `client.ts`) é
    obrigatório (não opcional) — sinaliza no tipo que o backend sempre
    espera o campo, mesmo que o valor só possa ser `true` na prática
    (o botão já trava disso no popup).
- **Testado via curl + Postgres direto** (todos os registros de teste
  apagados ao final, nenhum em cima de dado real): sem `acceptedTerms`
  → `400`; `acceptedTerms: false` explícito → `400` (confirma que o
  `@Equals(true)` pega os dois casos, não só ausência); `birthDate` de
  17 anos atrás → `400` "É necessário ter 18 anos..."; maior de idade +
  termos aceitos → `200`, com `terms_accepted_at` gravado com timestamp
  real no banco.

## Escanear QR do evento pela câmera, dentro do app (2026-07-31)

Antes, quem escaneava o QR do evento precisava usar a câmera nativa do
celular (a URL codificada no QR, `${origin}/join/${eventCode}`, abre o
navegador direto — ver "Código + QR de evento" mais acima). Pedido do
usuário: dar a opção de escanear sem sair do app, pra quem já está
navegando dentro do Cheer Cup e vê o QR físico impresso/projetado no
evento.

- **Lib nova: `qr-scanner`** (não `@zxing/*` nem `jsqr` cru) — decide
  câmera+decodificação+worker sozinha, API pequena
  (`new QrScanner(videoEl, onDecode, options)` +
  `.start()`/`.stop()`/`.destroy()`), TypeScript nativo. Versão 1.4.2:
  o próprio pacote avisa no código que configurar `WORKER_PATH`
  manualmente "não é mais necessário nem suportado" — resolve o
  dynamic import do worker sozinho, Vite já lida com isso nativamente
  (confirmado sem nenhuma config extra, nem no dev nem no build).
- **`QrCodeScanner.tsx`** (novo componente, `apps/web/src/components`):
  só liga a câmera enquanto a prop `active` é `true` — nunca eager,
  nunca fica rodando em segundo plano. `onScan` é guardado num `ref`
  atualizado a cada render (não como dependência direta do `useEffect`
  que abre a câmera) — sem isso, toda vez que o componente pai
  re-renderiza com uma closure nova de `onScan`, o efeito reiniciaria
  câmera/scanner à toa. Ao ler QUALQUER código, chama `scanner.stop()`
  antes de disparar `onScan` — sem isso o scanner continua decodificando
  quadro a quadro e dispararia a mesma leitura repetidas vezes enquanto
  o pai ainda processa a tentativa anterior (o vídeo trava no último
  frame, dando feedback visual de "capturado"). Cleanup do `useEffect`
  sempre chama `stop()` + `destroy()` — cobre fechar o dialog, trocar de
  aba, ou desmontar por qualquer motivo.
- **`JoinByCodeDialog.tsx`** ganhou abas (`Tabs` do shadcn, componente
  novo no projeto — `npx shadcn add tabs`, Base UI por trás como o
  resto): "Digitar código" (fluxo antigo, inalterado) e "Escanear QR"
  (`QrCodeScanner`, com `active={open && mode === "scan"}` — câmera só
  liga com o dialog aberto E essa aba selecionada). As duas abas
  convergem pro mesmo `joinWithCode(code)` compartilhado — sucesso já
  fecha o dialog e chama `onJoined` (mesmo comportamento de sempre);
  falha mostra o mesmo `FormError` de cima e incrementa um contador
  `scanAttempt`, usado como `key` do `QrCodeScanner` — forçar remount é
  o jeito mais simples de fazer o scanner voltar a escanear depois de um
  código inválido/expirado (ele já tinha parado sozinho ao ler o
  primeiro resultado).
- **`extractEventCode(scanned)`** (helper local, `JoinByCodeDialog.tsx`):
  o QR de verdade codifica a URL inteira, não só o código — tenta
  `new URL(scanned)` e extrai o segmento depois de `/join/`; se não for
  uma URL válida (QR gerado de outra forma, ex. impresso só com o
  código puro), usa o valor escaneado como está. Backend já normaliza
  o código (`trim/uppercase/strip`, `EventsService.joinByCode`), então
  não precisou duplicar essa parte no frontend.
- **Câmera pedida sob demanda, nunca a de vídeo-chamada por padrão**:
  `preferredCamera: "environment"` (traseira) — faz sentido pro caso de
  uso (apontar pro QR físico), diferente da frontal que a maioria dos
  navegadores usa por padrão.
- **Testado**: typecheck limpo; UI verificada no navegador (abas
  trocam, container de vídeo aparece ao selecionar "Escanear QR", sem
  erro no console — só um aviso inofensivo da própria lib
  ("only accessible if the page is transferred via https", dev em
  `http://localhost`, não aparece em produção que já é HTTPS). **Não
  testado com câmera de verdade nesta sessão** — o navegador
  automatizado usado pra verificar a UI não tem hardware de câmera
  disponível/permissão configurada, e o prompt nativo do Chrome pra
  autorizar câmera é UI do próprio navegador (fora do DOM da página),
  não dá pra clicar via automação. Vale um teste manual do usuário num
  celular de verdade antes de considerar pronto.
- **Política de Privacidade** (`PrivacyPolicyPage.tsx`) ganhou uma
  seção nova ("2. Acesso à câmera (QR code)", demais seções
  renumeradas) deixando explícito que o vídeo é processado só no
  navegador do usuário, nunca enviado/gravado — decisão consciente de
  não tratar isso como "coleta de dado novo" de verdade (o vídeo nunca
  sai do dispositivo), mas documentar por transparência mesmo assim.

## Animação de raio ao logar/cadastrar (2026-07-31)

Pedido do usuário: reaproveitar a mesma animação de raio+clarão já usada
em duas situações (fundo da LoginPage, variant="split", com fotos; e o
overlay "Prontos para o show!" ao publicar evento,
`PublishCelebrationOverlay`, variant="plain", com uma foto própria por
trás) — só que desta vez **sem nenhuma imagem de fundo**, disparada ao
logar com sucesso OU terminar o cadastro (`RegisterDialog`).
`BrandBackdrop` já tinha o variant certo pra isso (`variant="plain"`,
raio risca + clarão branco, fundo transparente do primeiro frame) —
não precisou de nenhuma mudança nesse componente, só um novo jeito de
dispará-lo. Passou por duas versões nesta mesma sessão — a primeira
tinha um bug real de performance, corrigido na segunda.

- **1ª versão (store global) — tinha um problema real de UX, não só de
  arquitetura**: login bem-sucedido chamava `useAuthStore.login()`
  IMEDIATAMENTE (setando `accessToken`), disparando a animação em
  seguida. Só que `GuestRoute` reage ao token na hora — troca
  `<Outlet/>` (LoginPage) por `<Navigate to="/" />" no mesmo instante,
  ANTES da minha própria chamada explícita de `navigate("/")` sequer
  rodar. Ou seja: a Home já começava a montar e buscar dados **ao
  mesmo tempo** que a animação do raio tentava rodar, competindo pelo
  mesmo thread principal — resultado: usuário relatou a animação
  "travada"/soluçando. A solução inicial (um store `Zustand`
  `lightningTransition.ts`, renderizado como irmão de `<Routes>` em
  `App.tsx`, sobrevivendo à troca de rota) resolvia o problema de
  desmontagem, mas não esse problema de concorrência de thread — nunca
  chegou a ser a versão final.
- **2ª versão (final) — adia `login()` até a animação acabar,
  sem precisar de nenhum store novo**: a causa raiz era chamar
  `login()` cedo demais, não onde a animação vive. Corrigido invertendo
  a ordem: o token vem da API e fica em `pendingToken` (estado local,
  `LoginPage`/`RegisterDialog`), a animação (`BrandBackdrop
  variant="plain"`) toca ALI MESMO — ainda em `/login`, com a Home nem
  tendo começado a montar — e só no `onDone` da animação (~900ms
  depois) é que `login(pendingToken)` roda de verdade, seguido de
  `navigate("/")`. Como `GuestRoute` só reage quando `login()`
  realmente é chamado, a troca de rota (e o trabalho de montar/buscar
  dados da Home) só começa DEPOIS da animação já ter acabado — sem
  concorrência, sem soluço. Isso eliminou a necessidade do store global
  (`store/lightningTransition.ts` foi deletado): já que `LoginPage`/
  `RegisterDialog` continuam montadas durante toda a animação (o token
  ainda não foi setado, então `GuestRoute` não redireciona), um
  `useState` local basta.
  - `LoginPage.handleSubmit`: `authApi.login()` → `setPendingToken()`
    (não `login()` ainda) → `<BrandBackdrop variant="plain"
    onDone={completeLogin} />` renderizada condicionalmente → `onDone`
    chama `completeLogin()`, que só ENTÃO chama `login(pendingToken)` +
    `joinPendingEventIfAny()` + `navigate("/")`.
  - `RegisterDialog.submitPassword`: mesmo padrão
    (`authApi.setPassword()` → `setPendingToken()` →
    `completeRegistration()` no `onDone`, que chama `login()` +
    `handleOpenChange(false)` + `onSuccess()`). O popup continua aberto
    por trás enquanto o raio cobre a tela inteira — `BrandBackdrop`
    renderizado com `z-[60]` (não `z-50`, igual ao `Dialog`) pra
    garantir que fica por cima do popup independente da ordem de
    portal do Base UI.
  - De propósito NÃO dentro de `useAuthStore.login()` em si — esse
    mesmo método também é chamado por `startImpersonation`/
    `stopImpersonation` (ver `store/auth.ts`), onde a animação não faz
    sentido (ação de admin trocando de conta, não um "bem-vindo" de
    verdade).
- **Testado via `javascript_tool`** (nunca com credencial real — ver
  `feedback_browser_testing_real_data.md`): expondo temporariamente
  `setPendingToken` em `window.__setPendingToken` de dentro da própria
  `LoginPage` (revertido logo em seguida), disparado com um token falso
  enquanto deslogado de verdade em `/login`. Confirmado que o caminho
  fica em `/login` com o `<polyline>` do raio no DOM durante toda a
  animação, e só troca pra `/` no exato instante em que o overlay some
  — nunca antes. (Números absolutos de tempo do primeiro teste saíram
  incoerentes — Chrome throttla `setTimeout` de aba em segundo plano/
  sem foco pra ~1x/segundo, esticando os ~900ms reais; a SEQUÊNCIA
  relativa, que é o que importa, ficou confirmada mesmo assim.)
- **Incidente real durante esse teste**: a sessão real do usuário no
  Chrome foi perdida — o backup de `localStorage['easyjudge-auth']`
  feito antes de deslogar pra testar acabou não sendo restaurado
  corretamente (o valor "restaurado" tinha o tamanho de um token de
  teste, não da sessão real), e não havia como recuperar localmente.
  Usuário precisou logar de novo manualmente; nenhum dado de
  servidor foi afetado, só o token local. Lição registrada em detalhe
  em `feedback_browser_testing_real_data.md` (novo caso, 2026-07-31) —
  sequências de teste que chamam `login()`/`logout()` de verdade (não
  só leem estado) são mais arriscadas de fazer save/restore do que
  parecem à primeira vista.

## Raio ao abrir evento ao vivo + celebração ao iniciar evento (2026-08-01)

Duas extensões do trabalho de animação acima, pedidas na sequência.

- **Abrir um evento publicado/iniciado pela listagem (Home) agora toca o
  raio primeiro** — mesmo `BrandBackdrop variant="plain"` sem mensagem
  do fix de login/cadastro, mesmo motivo (navegar antes faria a tela ao
  vivo começar a montar/buscar dados ao mesmo tempo que a animação,
  competindo pelo thread principal). `EventListItem`/`EventGridItem`
  (clique no card inteiro, não nos pills/menu internos — esses já
  paravam propagação) pararam de chamar `navigate()` direto pro caso
  `isLive` (`published`/`started`) — ganharam uma prop nova
  `onOpenLive(event)`, implementada em `HomePage` como
  `setPendingOpenEvent(event)`; a navegação de verdade só acontece no
  `onDone` do `BrandBackdrop`. Caso `isConfigurable` (`created` →
  `/setup`) não mudou, continua navegando direto — o pedido era
  especificamente sobre evento "já iniciado" (ao vivo).
- **`EventCelebrationOverlay`** — generalização do antigo
  `PublishCelebrationOverlay` (arquivo renomeado/substituído, mesma
  animação/fundo `bg-publish-celebration.webp`) pra aceitar
  `title`/`subtitle`/`actionLabel`/`onAction` como props em vez de
  texto fixo — usado agora em **3 lugares**, cada um com texto/ação
  própria:
  - `EventSetupPage` (publicar): texto original "Prontos para o
    show!", inalterado.
  - `HomePage` (clique no pill "Iniciar evento" da listagem): "Vamos
    começar o show!" / "O evento começou — boa competição!", botão "Ir
    para o evento ao vivo" → navega pra `/events/:id/live`.
  - `EventLiveDashboardPage` (botão "Iniciar evento" na própria tela ao
    vivo, mobile E desktop — os dois compartilham o mesmo `handleStart`,
    então um `useState` só cobre as duas visões): mesmo texto, mas
    botão "Continuar" só fecha o overlay — já está na tela certa, não
    precisa navegar.
- **Testado ponta a ponta com conta e eventos descartáveis** (usuário
  organization novo, 2 eventos publicados com `startDate` de hoje —
  necessário pra `EventLifecycleAction.canStart` liberar o pill, que
  exige `isEventDay`; conta/eventos deletados ao final, incluindo um
  `DELETE FROM event_activity_logs` manual — a exclusão do `User` bateu
  em FK de `event_activity_logs.actor_id`, que não é limpa em cascata):
  os 3 fluxos confirmados visualmente — raio puro abrindo evento ao
  vivo pela Home (URL já muda pra `/live` mas o frame do raio ainda
  aparece por cima da Home, confirma que a troca de rota só ocorre
  depois do `onDone`); celebração completa iniciando pelo pill da Home,
  com o botão levando pro evento; celebração iniciando de dentro da
  própria tela ao vivo, com "Continuar" só fechando no lugar.
- **Incidente à parte, não relacionado ao código**: uma aba nova criada
  por engano durante o teste mostrou por um instante a sessão real do
  usuário (login feito por ele mesmo, em algum momento entre turnos,
  já que a sessão anterior tinha sido perdida — ver incidente acima) —
  fechada sem nenhuma ação além de um clique perdido em área vazia da
  Home (sem efeito). O teste de verdade foi refeito só depois de
  confirmar a aba estava deslogada.

## Próximos passos (não iniciados ainda)

**Atualização (2026-07-28):** o item 1 antigo (tempo real) **já foi
feito** — ver seção "Tempo real (Socket.io self-hosted)" logo acima.
**Atualização (2026-07-27):** os itens 1 ("lançamento de notas") e 6
("jornada do atleta/espectador") desta lista, como estava escrita até
2026-07-19, **já foram feitos** — ver seção "Nota sobre este arquivo"
no topo e "Jornada do usuário" logo abaixo dela. O item 2 antigo
("transição de status `completed`") **também já foi feito** nesta
mesma data — ver "Transição `started` -> `completed`" logo acima. O
antigo item 3 ("endereçamento por aliasId nas rotas HTTP") **também já
foi feito**, nesta mesma data — ver seção logo acima. Lista renumerada
só com o que continua de fato pendente:

1. Cobertura de testes automatizados: nenhum service/guard do projeto
   tem `.spec.ts` ainda — todo o backend segue validado só manualmente
   (curl/navegador), o que já escalou mal o suficiente pra virar risco
   real com esse volume de domínios interdependentes (hoje inclui
   `scoring`/`notifications`/`athletes` também, não só os módulos de
   setup do evento).
2. **Backfill de documentação (2026-07-19 → 2026-07-26).** O período
   que construiu lançamento de notas, o painel "evento ao vivo"
   inteiro, notificações, jornada do atleta e impersonation não tem o
   detalhamento de decisão/gotcha que o resto deste arquivo tem (ver
   nota no topo do arquivo) — só reconstruir isso com precisão exigiria
   ou as transcrições de sessão daquele período (não disponíveis aqui)
   ou uma exploração grande de código pra reverse-engineer decisões
   sem garantia de acertar o "porquê". Fora de escopo até o usuário
   pedir explicitamente.

## Gotchas / decisões técnicas já resolvidas (não repetir o troubleshooting)

- **`cd apps/web && npx tsc --noEmit -p .` NÃO faz typecheck de
  verdade — compila ZERO arquivos, sempre "limpo" mesmo com erros reais**
  (pego em 2026-07-27, depois de ter "confirmado" duas rodadas de
  mudanças como limpas quando na verdade havia `Record` incompletos
  reais — ver `EVENT_ACTIVITY_ACTION_LABELS`/`EVENT_ACTIVITY_ACTION_ICONS`
  abaixo). Causa: `apps/web/tsconfig.json` (raiz) é só um manifesto de
  **project references** (`"files": []`, só `references` pra
  `tsconfig.app.json`/`tsconfig.node.json`) — pensado pra `tsc -b`
  (modo build/composite), não pra `tsc --noEmit -p .` direto (que nesse
  modo só processa o que `files`/`include` da raiz listam, ou seja,
  nada). O comando certo é **`npx tsc -b --force`** (mesmo que
  `npm run build` roda antes do `vite build`) — ele de fato desce nos
  dois projetos referenciados e reporta erro real. Confirmar com
  `npx tsc --noEmit -p . --listFilesOnly | wc -l`: se der `0`, o
  comando não está checando nada. `apps/api` não tem esse problema
  (`tsconfig.json` tem `include` de verdade via ausência de
  `"files": []`/`references`) — só o `apps/web` precisa do `-b`.
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

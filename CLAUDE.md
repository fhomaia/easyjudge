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

**Nota (2026-08-01, atualizada em 2026-09-25):** o log detalhado de
decisão/gotcha dos períodos 2026-07-12→07-19, 2026-07-26→07-28 e
2026-07-31→08-05 foi movido para `docs/CLAUDE_HISTORY.md` (mesmo motivo de sempre: limite de 150k
caracteres suportado como instrução de projeto). Esse arquivo não é
carregado automaticamente; abra-o sob demanda quando precisar do
"porquê"/gotcha de uma decisão antiga que não esteja detalhada aqui. O
resumo abaixo cobre o que existe hoje de cada feature desse segundo
período (desistência de apresentação, aliasId nas rotas HTTP, ciclo de
vida do evento, mover apresentação, faixas de pontuação, trava de
template em uso) — nada foi perdido, só o passo a passo de como se
chegou lá.

- **Desistência de apresentação**: `ScheduleEntry.withdrawnAt` (nunca
  limpo) + `removedFromSchedule` (só admin/assessor liga, afeta só a
  visão de cronograma). Admin/assessor desistem de qualquer
  apresentação; programa só das próprias equipes, sempre sem remover
  do cronograma. Só possível antes do primeiro `ScoreEvent`. Súmulas
  mostram a apresentação desistida com badge "Desistência" e resultado
  zerado; lançar nota numa apresentação desistida dá 403. Notifica
  audiência `ALL` (`PRESENTATION_CANCELLED`). UI: menu "⋯" na linha da
  apresentação em `EventLiveSchedulePage`, `WithdrawPresentationDialog`.
- **Endereçamento por `aliasId` nas rotas HTTP**: toda rota
  `/events/:id`/`/events/:eventId/...` resolve o parâmetro por
  `aliasId` (estável através de republicações), não mais pelo `id` de
  uma versão específica — `GET`/ações filhas sempre pegam a versão
  ativa mais recente; endereçar o `id` de uma versão antiga dá `404`.
  Cobre `EventsService`, `NotificationsService`,
  `ProgramsService.findAllForUser`/`JudgesService.findAllForUser` e
  todo domínio filho (categories/programs/teams/judges/judging/
  schedule/regulations/scoring/event-staff/member-counts). Nenhuma
  rota do `App.tsx` mudou de path, só o valor guardado em `:id`.
- **Ciclo de vida do evento**: `Event.completedAt` +
  `POST /events/:id/complete` (`started → completed`, admin/assessor,
  via `ConfirmDialog`) fecha a transição que faltava. "Publicar"/
  "Concluir" saíram da listagem da Home (só "Iniciar evento" continua
  lá); concluir só pela tela "Início" do evento ao vivo.
  `EditEventDialog` trava campos pra evento `published`/`started` e
  oferece "Reverter publicação" (`unpublishEvent` aceita
  `started → created` também, zerando `startedAt`) — reverter um
  `started` com `ScoreEvent` já lançado não é bloqueado (decisão
  deliberada do usuário, notas continuam no banco).
- **Código + QR de evento pra espectador**: `Event.eventCode` (8
  caracteres, estável entre republicações — gerado na **criação** do
  evento desde 2026-09-23, era só na 1ª publicação antes disso, ver
  seção "Evento em rascunho visível..." mais abaixo) +
  `POST /events/join-by-code` (sem guard de membership, concede
  `SPECTATOR` via `upsertMemberRole`, idempotente). QR renderizado no
  cliente (`qrcode.react`) codificando `${origin}/join/${eventCode}`.
  `ShareEventDialog` (admin, Setup/Home) e `JoinByCodeDialog` (header
  da Home) — este último ganhou uma aba "Escanear QR" própria (ver
  resumo em "Cadastro, termos, QR, animações e UX do setup" mais abaixo). `/join/:code`
  é rota pública; loga e resgata na hora, ou guarda o código em
  `localStorage` e resgata após login/cadastro.
- **Mover apresentação no evento ao vivo**: admin/assessor movem pista
  e/ou posição de uma apresentação já agendada, dentro do mesmo dia,
  via popup (`MovePresentationDialog`, mesmo endpoint de mover já usado
  pelo drag-and-drop do Setup). Notifica audiência `ALL` +
  `EventActivityAction.PRESENTATION_MOVED` (só fora de `status=created`).
  Reconciliação de aquecimento/intervalos automáticos
  (`reconcileWarmupDelays`/`reconcileTeamWarmupOrder`/
  `reconcileMatGaps`) roda em conjunto, em laço, pra manter a ordem
  aquecimento→apresentação intercalada por equipe sem deixar folga ou
  intervalo órfão sobrando — histórico completo dos 3 bugs de perda de
  dado/reconciliação encontrados durante o teste está em
  `docs/CLAUDE_HISTORY.md`.
- **Download de súmula impressa** (PDF/Excel) a partir da listagem e do
  builder de sistemas de pontuação (`lib/scoringTemplateExport.ts`).
  Layout do PDF é texto corrido (não tabela), baseado numa súmula real
  da ICU — cada grupo-raiz é uma seção atômica que nunca corta no meio
  de uma quebra de página.
- **Trava de edição de sistema de pontuação em uso**:
  `ScoringTemplatesService.assertNotLockedForEditing` bloqueia (`409`)
  editar template/critério enquanto ele está vinculado a uma categoria
  de evento fora de `created`. Campo computado `ScoringTemplate.isLocked`
  (badge "Travado" na listagem, banner + campos desabilitados no
  builder) — leitura/download continuam livres, só mutação é bloqueada.
- **Documentos do regulamento acessíveis na tela "Início"** do evento
  ao vivo (dropdown com os documentos de `regulation.documents`, abre
  em nova aba) — rota `GET .../regulation` ganhou override pra liberar
  pra toda audiência de `useEventLiveGuard` (não só admin/assessor).
- **Faixas de pontuação opcionais** (`ScoringCriterion.useScoreBands`/
  `scoreBands`, jsonb): faixas nomeadas com cor cobrindo 0 até
  `maxScore` (sobreposição permitida, vão não). Efeito visual na tela
  do jurado (`showScoreBands` prop em `ScoringCriteriaGroups.tsx`, não
  usado pelo Painel Head Judge): descrição clicável de grupo/critério/
  faixa (`CriterionInfoPopover`), badge da faixa atual no mobile
  (`CurrentBandBadge`), slider colorido só no desktop
  (`ScoreBandSlider.tsx`, `@base-ui/react/slider` direto) com a
  descrição da faixa atual embaixo. Também mostra, por critério, qual
  equipe tem a maior nota até agora na mesma categoria (`bestScore`,
  troféu no slider/texto no mobile).
- **Bug real corrigido: nota de item com mais de um jurado usava só a
  última gravada, não a média.** `computeAverageScoreByCriterion`
  (método privado compartilhado em `ScoringService`) agora tira a média
  por jurado antes de somar o total oficial e o detalhe por critério —
  a súmula de detalhe passou a mostrar só o valor final, sem listar
  jurado por jurado (decisão do usuário).
- **Pendências fechadas em 2026-07-28**: split de firstName/lastName no
  roster de `JudgesService`; descrição de subgrupos intermediários
  chegando no jurado (`subgroupDescriptions`); bug real de
  `Object.assign` apagando `scoreBands` da resposta HTTP em qualquer
  update de critério (dado no banco nunca foi afetado, só a resposta
  imediata) — motivou `hasStaleScoreBands`/banner de faixas
  desatualizadas após mudar `maxScore`.

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
4. **Backend (Render)**, publicado em
   `https://cheercup-api.onrender.com` — subiu no plano Free (cold-start
   de ~50s depois de 15min parado), decisão consciente do usuário pra
   evitar custo de POC até ter competição real. **Migrado pro plano
   Starter (~$7/mês) em algum momento até 2026-09-21** — sem cold-start
   desde então (confirmado pelo usuário nessa data; a mudança em si não
   ficou registrada aqui, não há data exata nem se foi feita pelo
   dashboard do Render ou outra forma).
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

**Pontas soltas conscientes** (na época do deploy inicial): Render Free
em cold-start (ver item 4 acima — já resolvido, plano Starter desde
antes de 2026-09-21). As outras duas foram resolvidas em 2026-09-20: `www.cheercup.com.br`
já estava configurado (confere por `dig`/`curl`: resolve pro Cloudflare,
cert válido, serve o app e as rotas SPA; **serve direto, não redireciona
pro domínio raiz**, então existem duas URLs válidas — redirect é
opcional), e o bundle do frontend passou por code-splitting (ver seção
"Code-splitting por rota" mais abaixo).

## Cadastro, termos, QR, animações e UX do setup (2026-07-31 a 2026-08-05)

Resumo do que continua valendo; o texto completo (passo a passo, testes
e incidentes) foi movido em 2026-09-25 para `docs/CLAUDE_HISTORY.md`.

- **Cadastro por papel** (`RegisterDialog`): atleta/espectador não
  informa equipe, e o documento é só CPF e opcional
  (`@ValidateIf` no DTO + `AuthService.register` recusa CNPJ pra atleta;
  `User.documentType/documentNumber` nullable, precisam de
  `type: 'varchar'`). Programa não informa sobrenome (`lastName` vira
  `''`, nunca `undefined`); nome de exibição via
  `ProgramsService.buildUserDisplayName` e `.trim()` nas concatenações
  do front. Rótulo do papel: "Programa/Ginásio".
- **Data de nascimento**: perguntada pra quem usa CPF e sempre pra
  atleta. **Idade mínima 13 anos** (era 18 até 2026-08-01) em 3 pontos:
  `AuthService.register`, `UsersService.updateProfile` e
  `getMaxBirthDate()` (`lib/birthDate.ts`). Sem fluxo de consentimento de
  responsável (LGPD art. 14): decisão de produto, só autodeclaração
  (cláusula nos Termos). Não é revisão jurídica.
- **Termos/Privacidade**: `/terms` e `/privacy` são rotas públicas.
  Aceite obrigatório no cadastro (`RegisterDto.acceptedTerms` com
  `@Equals(true)`), gravado em `User.termsAcceptedAt` +
  `User.termsVersion` (`CURRENT_TERMS_VERSION` em `UsersService`,
  formato `AAAA-MM-DD`). Mudou o TEXTO das páginas: bumpar a versão e o
  `updatedAt` exibido juntos.
- **Email de verificação**: HTML em tabela com estilo inline (Outlook
  ignora `<style>`), logo por URL pública fixa
  (`https://cheercup.com.br/logo.png`).
- **Escanear QR pela câmera** (`JoinByCodeDialog`, aba "Escanear QR"):
  lib `qr-scanner`; `QrCodeScanner` só liga a câmera com `active`, para
  ao ler o primeiro código e é remontado por `key` depois de um código
  inválido; `extractEventCode` aceita a URL `/join/:code` ou o código
  puro. Nunca testado com câmera de verdade pela automação.
- **Animação de raio** (`BrandBackdrop variant="plain"`): no
  login/cadastro, o token fica em `pendingToken` e `login()` só roda no
  `onDone`, senão a Home monta junto e a animação engasga. Não fica em
  `useAuthStore.login()` (usado também pelo "ver como"). Abrir evento ao
  vivo pela Home também toca o raio antes de navegar.
  `EventCelebrationOverlay` (publicar e iniciar evento) recebe
  título/ação por props.
- **Calendário com seletor de mês/ano**: o `nav` do react-day-picker
  cobria os selects (`pointer-events-none` nele,
  `pointer-events-auto` nas setas), e o `SelectContent` dentro do
  Popover precisa de `alignItemWithTrigger={false}`.
- **"Esqueci minha senha"**: popup `ForgotPasswordDialog` sobre a
  LoginPage (email → código → nova senha); `password_resets` sempre
  cria linha, pra não revelar se o email existe. `PasswordInput` (olho de
  mostrar/ocultar) em todos os campos de senha.
- **Setup/Cronograma (2026-08-05)**: "Gerenciar equipe" só lista papéis
  de staff; `PresentationDetailsDialog` ao clicar numa apresentação da
  timeline (calcula a posição de inserção já simulando a remoção da
  própria apresentação e das esperas ligadas a ela); arrastes usam
  `DragOverlay` (portal, imune ao `overflow` do painel de origem);
  overlay de "salvando" só sobre a timeline/tabela; grid da coluna do
  cronograma sem `min-h-0` (senão a timeline vaza por cima do banner);
  primeiro recurso de dia novo se chama "Palco 1".
- **Incidente registrado**: testar fluxos que chamam `login()`/`logout()`
  de verdade no navegador já apagou a sessão real do usuário (ver memória
  `feedback_browser_testing_real_data`). Testes que precisam logar usam
  outra origem (`127.0.0.1` em vez de `localhost`) com conta descartável.

## Geração automática reformulada, eventos especiais e pontos de soltura do arraste (2026-09-19)

Rodada grande no Cronograma (`SchedulePage`), commits `4abfefd`,
`652c7a2` (api) e `2642ca7` (web), já em produção (ver "Deploy" abaixo).

- **Aquecimento/recurso de aquecimento só saem junto** (`4abfefd`):
  `removeEntry` dá `400` pra aquecimento e pra "Aguardando..." soltos;
  `removeResource` dá `400` pra recurso de aquecimento e, ao excluir uma
  pista, leva junto os aquecimentos vinculados e os recursos de
  aquecimento pareados (FK de `linkedEntryId` é `SET NULL`, sem isso
  ficavam órfãos). Renomeado "Componentes" -> "Eventos especiais" na UI.
- **Configuração por EVENTO** (não por dia nem por usuário): tabela
  `schedule_auto_settings` (`aliasId` único, sem FK, limpa em
  `EventsService.deleteEvent` via `EVENT_SCOPED_ENTITIES`) com
  `orderPrimary` (`format`|`level`), `levelDirection`, `formatOrder` e
  `specialEvents` (jsonb). `GET`/`PUT /events/:id/schedule/
  auto-generate-settings`; sem linha = padrão (formato primeiro, nível
  crescente, sem eventos), então eventos antigos não mudam. `PUT`
  exige o corpo completo (inclusive `specialEvents`).
- **Ordenação**: "categoria" na UI = o FORMATO da categoria. Chave de
  ordem = `autoFormatKey` (`team_cheer`, `group_stunt`, `coed`,
  `partner`, `custom` ou `custom:<rótulo>` — cada Custom vale pelo
  nome). Existe nos dois lados (`schedule/enums/auto-generate-order.
  enum.ts` e `web/src/lib/autoFormatKey.ts`), manter em sincronia.
  Formato fora da lista salva cai no fim, na ordem padrão. A lista do
  modal só mostra formatos que existem nas categorias do evento.
- **Eventos especiais** (Almoço, Abertura, Premiação, Contestação,
  personalizado) no lugar dos campos fixos de almoço: âncora `time`/
  `start`/`end`/`before`/`after`, validação de ciclo/referência em
  `schedule/special-events.ts` (`findSpecialEventsProblem`,
  `planSpecialEvents`). Entram em TODAS as pistas (e nas áreas de
  aquecimento, alinhadas só quando ainda há apresentação depois). A
  duração informada é a MÍNIMA: `syncSpecialEventEnds` faz cada evento
  terminar no mesmo horário em todas as pistas (estende as que chegam
  antes; áreas de aquecimento ficam com a duração mínima). Horário fixo
  = entra antes da apresentação que ultrapassaria (não padda até a hora
  exata). `autoGenerate` APAGA e refaz o dia inteiro, por isso a lista
  lembrada não duplica.
- **Distribuição entre pistas** (balanceada/sequencial) foi REMOVIDA:
  cada apresentação, na ordem definida, vai pra pista onde começa mais
  cedo (`estimateStart` considera fim da pista, gap, aquecimento mais
  livre, equipe ocupada e eventos de horário fixo; empate = 1ª pista).
  Perdeu-se o uso "uma categoria por pista" (só movendo à mão).
- **Modal em duas etapas** (`AutoGenerateDialog` + `SpecialEventsEditor`
  + `AutoGenerateOrderFields`): 1) horário/aquecimento/intervalo/eventos
  especiais, 2) ordem (critério principal, secundário automático,
  categorias reordenáveis por arraste `@dnd-kit/sortable` ou setas).
  Mobile: `p-5`, grades de 1 coluna, `w-full min-w-0` nos campos; rótulos
  do "Quando" curtos no celular (`useIsMobile`), completos no desktop.
- **Bug real do arraste** (mover apresentação pra antes de outra): o
  aquecimento recriado entrava sempre no FIM da fila de aquecimento e a
  pista esperava ~80 min. `createPresentationWithWarmup` agora insere o
  aquecimento na mesma ordem relativa da apresentação (antes do
  aquecimento da próxima e de eventos especiais seguintes; prefere a
  área que já tem aquecimento de apresentação seguinte) e cola posição
  de inserção que cairia no meio de um grupo espera+apresentação na
  frente do grupo (`snapToPresentationGroupStart`). Contrato de
  `order` em `moveEntry`: relativo à fila SEM o item movido (e sem as
  esperas ligadas a ele, se apresentação).
- **Pontos de soltura** (`web/src/lib/dropSlots.ts`, usado por linha do
  tempo E tabela via `SchedulePage.resolveDropTarget`): só existem
  pontos antes/depois de itens reais (apresentação, aquecimento, evento
  especial); esperas e "Intervalo entre apresentações" são breaks com
  `linkedEntryId` e nunca são alvo. Regra: ponto antes do primeiro item
  real cujo MEIO está à frente da borda esquerda do item arrastado
  (mais próximo errava quando a espera era longa); na tabela, célula de
  item real = metade de cima/baixo. Marcadores durante o arraste; a
  célula da tabela arrastada usa `data.kind: "tableEntry"` (o kind
  `entry` acionaria o `DragOverlay` duplicado). Apresentação só tem
  pontos em pistas; soltar em recurso que não aceita dá mensagem.
- **Layout**: banner "Próxima etapa" sem respiro (o `div` externo tinha
  `min-h-0` e encolhia abaixo do conteúdo, o `pb-10` não contava —
  removido); barra de rolagem fina visível na linha do tempo
  (`scrollbar-slim` em `index.css`; `scrollbar-none` continua no
  `SetupProgressSummary`).
- **Testes**: sem `.spec.ts` (pendência antiga). Validado por scripts
  descartáveis contra a API local com evento/usuário de teste apagados
  ao final (82 movimentos = cada apresentação x cada ponto de soltura,
  com Almoço e Premiação; fim comum dos eventos entre pistas; simulação
  independente da distribuição por menor início).
- **Deploy (2026-09-19)**: migration `CreateScheduleAutoSettings`
  rodada no Neon pelo usuário (78 -> 79, `DATABASE_URL` inline no
  terminal dele) ANTES do push; o push em `master` dispara Render
  (backend) e o build do Cloudflare (frontend). Conferido por `curl`
  (rota nova `404` -> `401`; bundle publicado com o código novo).
  Produção ainda sem nenhum usuário real.

**Gotchas desta rodada**
- `npm run migration:generate` traz DERIVA de schema alheia (dropa
  índices únicos parciais de `events.event_code`/`event_members`, FKs,
  refaz enum de `event_members`) — nunca rodar o arquivo gerado como
  está; reduzir só ao que a mudança precisa e conferir o SQL.
- Testar no navegador (Claude in Chrome): `resize_window` NÃO altera o
  `innerWidth`; pra simular celular/desktop use um `iframe` de mesma
  origem com a largura desejada (a sessão vale e os breakpoints
  respondem). Aba sem foco throttla `setTimeout` (~1/s): loops com
  muitos `wait` estouram o timeout de 45 s — use `MessageChannel` pra
  ceder o loop. `left_click_drag` só manda início e fim (dnd-kit precisa
  de vários `pointermove`): simule com `PointerEvent` em passos curtos,
  sem levar o cursor perto da borda da timeline (auto-scroll trava a aba).
- Testar mutação no evento REAL do usuário só com backup antes
  (`create table zz_bak_entries as select ... from schedule_entries`) e
  restauro (`delete` + `insert ... select` numa única instrução, por
  causa da FK auto-referente de `linked_entry_id`) conferindo 0
  diferenças; apagar a tabela de backup depois.
- Módulo ES é estrito: `r = await f()` com `r` não declarada EXECUTA a
  chamada e só então lança — um script de teste com `DELETE` seguido
  disso apagou dado sem eu conferir. Sempre declarar (`let r`).

## Reorganização da tela de lançamento de nota + Rascunho com desenho/texto separados (2026-09-19)

Rodada de ajustes pedidos direto na tela `EventLiveScoringPage`/
`EventLiveScoringDesktopView` (jurado lançando nota), um de cada vez,
mesma sessão. Ainda não deployada (ver "Deploy" abaixo).

- **Slider de faixa de pontuação só colore a faixa ATUAL** — antes
  todas as faixas apareciam coloridas o tempo todo, achado "muito
  distrativo" pelo usuário. `buildBandGradient` (`lib/scoreBands.ts`)
  ganhou um 3º parâmetro opcional `highlightBand`: quando informado,
  só o segmento que bate com a faixa atual mantém a cor de verdade, os
  demais caem pra `var(--color-muted)`. `ScoreBandSlider.tsx` calcula
  `currentBand` primeiro e repassa pro gradiente.
- **Layout do desktop reorganizado**: Rascunho ao lado de Legalidade na
  linha 1 (Comentários sobe pra essa vaga quando não há jurado de
  legalidade na pista); faixas de pontuação na linha 2 (a última faixa
  sozinha numa linha ímpar estica pra ocupar a largura toda,
  `ScoringCriteriaGroups.tsx`); Comentários na linha 3 só quando já
  ocupou a linha 1 com Legalidade. Sem altura fixa no grid da linha 1
  (tentada e revertida — com muitos tipos de dedução cadastrados o
  card de Legalidade ultrapassava qualquer altura fixa razoável e as
  seções se sobrepunham); em vez disso, `LegalityDeductionsPanel` ganhou
  `max-h-48 overflow-y-auto` só na lista de últimos registros.
- **Bug real corrigido no `SketchCanvas` (rascunho por desenho)**:
  trocar de aba rápido demais (antes do debounce de 900ms salvar)
  descartava o traço em silêncio pra sempre. Causa: o cleanup do
  `useEffect` de desmontagem tentava reler `canvasRef.current`, mas o
  React zera essa ref pra `null` ANTES do cleanup rodar, não depois
  (contrário à suposição inicial, confirmado testando com
  `left_click_drag` de verdade — eventos de ponteiro sintéticos via JS
  não disparam `setPointerCapture`). Corrigido capturando o PNG de
  forma SÍNCRONA a cada edição (`scheduleSave`, dentro de
  `lastDataUrlRef`) — o debounce e o cleanup de desmontagem só releem
  esse ref, nunca o canvas.
- **Rascunho: desenho e texto viraram campos SEPARADOS no backend**
  (pedido do usuário depois de reportar "quando desenho apaga o que
  tinha escrito no modo caixa de texto e vice versa" — os dois
  dividiam o mesmo campo antes, format-sniffed pelo prefixo `data:`).
  Novo `ScoreEventKind.SKETCH_TEXT_SET` (mesma privacidade de
  `SKETCH_SET` — só o próprio jurado vê, nunca aparece pra Head
  Judge/admin/programa) + migration `AddSketchTextSetToScoreEventKind`
  (`ALTER TYPE ... ADD VALUE`, rodada no Postgres local; **ainda não
  rodada no Neon**, ver "Deploy"). `ReducedScoringState.sketchText`
  novo no reducer do frontend.
- **`SketchCanvas.tsx` virou o hook `useSketchCanvas`** (arquivo
  renomeado pra `components/scoring/useSketchCanvas.tsx`, só usado por
  `RascunhoEditor`), devolvendo `{ toolbar, canvas }` em vez de um
  componente monolítico — permite ao `RascunhoEditor` decidir onde
  cada pedaço entra na árvore, em vez da barra de ferramentas do
  desenho vir sempre grudada embaixo do canvas.
- **Duas linhas de cabeçalho do Rascunho viraram uma só** (pedido do
  usuário: "ganhamos uma linha de espaço na tela"): a nota "Visível
  apenas para você" saiu de dentro do `RascunhoEditor` e foi pro lado
  do título "RASCUNHO" no desktop (mesma linha, `EventLiveScoringDesktopView`);
  no mobile (sem título próprio, só a aba "Rascunho") ficou numa linha
  compacta acima do editor (`EventLiveScoringPage`). A barra de
  ferramentas do desenho (usando o hook acima) passou a aparecer do
  lado do toggle "Desenho livre/Caixa de texto", só quando
  `mode === "draw"` — antes vinha numa linha própria, exclusiva do
  modo desenho, o que também é o motivo de desenho/texto terem alturas
  diferentes antes do `stretchToFill` (agora as duas alturas batem
  igual em qualquer modo).
- **Testado no navegador** com um harness descartável (`ViewerTestPage`
  temporário, removido ao final junto com a rota `/viewer-test` de
  `App.tsx`) renderizando `EventLiveScoringDesktopView` com uma folha
  falsa e 9 tipos de dedução (pra also validar o scroll da lista de
  Legalidade): confirmado visualmente que Rascunho/Legalidade não se
  sobrepõem com as faixas abaixo; confirmado via DOM
  (`textarea.value`/`toDataURL`) que desenhar não apaga o texto já
  digitado e vice-versa; confirmado que a altura do card não muda ao
  trocar de modo. **A página mobile só foi conferida por leitura de
  código + typecheck, não testada visualmente no navegador** nesta
  rodada.
- **Deploy**: migration `AddSketchTextSetToScoreEventKind` ainda
  precisa rodar no Neon (usuário, `DATABASE_URL` inline no terminal
  dele) antes de qualquer push que inclua este backend.

## Code-splitting por rota (2026-09-20)

`apps/web/src/App.tsx`: todas as páginas, exceto `LoginPage`, viraram
`React.lazy` (`import("@/pages/X").then((m) => ({ default: m.X }))`,
já que as páginas são exports nomeados), dentro de um `<Suspense>` com
fallback "Carregando..." que envolve as `<Routes>`. `LoginPage`,
`ProtectedRoute` e `GuestRoute` continuam no bundle inicial (primeira
tela de quem está deslogado e guardas de rota).

- **Medido no build**: chunk principal `index-*.js` de 2.233 kB (670 kB
  gzip) para 379 kB (118 kB gzip); o aviso de chunk > 500 kB do Vite
  sumiu. Peças pesadas passaram a carregar só onde são usadas
  (`PdfViewer`, `jspdf`, `xlsx`, `html2canvas`).
- **Testado**: `vite preview` do build, no navegador deslogado (origem
  `localhost:4173`, sem sessão): `/terms` baixa o chunk
  `TermsOfUsePage` sob demanda; rota protegida sem sessão redireciona
  pra `/login` sem baixar chunk de página. **Não testado**: navegar
  pelas páginas protegidas já logado com o build de produção (exigiria
  sessão) — conferir em produção depois do deploy.
- **Aba aberta durante um deploy** pedia arquivos de tela antigos (nome
  com hash) e ficava em branco. Resolvido em 2026-09-25: `main.tsx`
  recarrega a página no `vite:preloadError`.

## Ajustes do teste cego com usuário (2026-09-21)

Rodada grande, feita um achado por vez com o usuário. Deploy em 3
commits (`baa9ef8` deduções, `8af691e` vínculo por email, `536c3bd` UX),
mais um de carregamento e este arquivo. Migrations novas rodadas no
Neon pelo usuário ANTES do push: `DeductionTypeToVarchar` e
`AddHiddenDeductionsToRegulations`.

**Cadastro (`RegisterDialog`)**
- Fechar o modal (X/clique fora/Esc) NÃO zera o formulário: o
  componente fica montado na `LoginPage`, então reabrir retoma da etapa
  onde parou. Só em memória (nada no `localStorage`: CPF, nascimento e
  senha não podem ficar gravados). Só o fim do cadastro chama `reset()`.
- Nome virou UM campo (`fullName`), com validação nativa (`pattern`,
  mesmo padrão do email); `splitFullName` separa no 1º espaço só na hora
  de enviar (API continua com `firstName`/`lastName`, sem migration).
  Programa segue com nome único e `lastName` vazio.
- Nenhum tipo de conta vem pré-selecionado: `role: "judge"` no
  `INITIAL_STATE` é só valor interno; a seleção mostrada vem de
  `roleChosen`. Erros do servidor aparecem em cada passo (entre o campo
  e o botão), não mais no topo do modal.
- `DatePicker` é digitável (máscara `dd/mm/aaaa`, `formatDateInput` em
  `lib/masks.ts`) e abre o calendário pelo ícone; `value` continua
  `yyyy-MM-dd`. Data inválida ou fora de `maxDate`/`startMonth` zera o
  valor (o "Continuar" trava).

**Deduções por evento (regulamento, modo Personalizado)**
- Modelo: `Regulation.customDeductions` (jsonb, `{id: "custom_<uuid>",
  label, value}`) e `Regulation.hiddenDeductions` (tipos IASF ocultados).
  `score_events.deduction_type` virou `varchar` (antes enum do Postgres).
  `DeductionRuleView` ganhou `label`/`isCustom`; `RegulationView`
  ganhou `hiddenDeductions` (pra restaurar). Nomes vêm da API em todo o
  front (`getDeductionLabel` só como fallback).
- Só no modo Personalizado (400 no IASF). Nome único (sem repetir os 9
  padrão nem outro criado), máx. 30 tipos, mínimo de 1 tipo visível.
- Excluir/ocultar tipo já usado em nota lançada, ou voltar pro IASF
  com tipo criado em uso, dá 409 (consulta em `score_events` via
  `schedule_entries`/`schedule_resources`/`schedule_days`). O valor da
  dedução NÃO fica na nota: é resolvido na leitura pelo tipo, então
  apagar/ocultar um tipo em uso mudaria notas já julgadas (por isso o
  bloqueio). Mudar o valor de um tipo depois de lançado continua
  retroativo (comportamento antigo, não travado).
- Ingestão de notas TOLERANTE de propósito: `deductionType` é string
  livre (não valida contra o regulamento). O jurado reenvia lotes do
  buffer offline; recusar um tipo apagado travaria o lote inteiro
  (contra o requisito "notas nunca perdidas"). Tipo desconhecido vira
  valor 0 e rótulo "Dedução removida".
- Sinal: a API guarda SEMPRE negativo (`toDeductionValue`, ignora o
  sinal recebido); a UI do regulamento mostra/pede só a magnitude
  ("Pontos deduzidos"). Súmulas continuam mostrando o "-". Nunca
  enviar lista parcial de `customDeductions`: linha ausente = exclusão.

**Contas, email e vínculo com evento**
- Tipo de conta é FIXO (só definido no cadastro; não existe troca).
  Decisão do usuário: manter assim por enquanto. Um email = uma conta,
  então quem quer ser jurado E programa precisa de dois emails.
- Jurado é atividade (qualquer conta menos Programa); Programa é
  identidade da conta. Por isso NÃO existe "papel de programa por
  evento". `linkUnclaimedMembersByEmail(userId, email, accountRole)`
  só reclama o papel PROGRAM do roster para conta Programa e JUDGE para
  conta não-Programa; linha pendente fica pendente (sem acesso pela
  metade).
- Cadastrar/editar jurado com email de conta Programa, ou programa com
  email de conta não-Programa, dá 409 (só checa quando o email muda:
  o formulário reenvia o email a cada salvamento). Editar agora vincula
  de verdade (`syncNewlyLinkedJudge/Program`: perfil, roster, atletas,
  remove o convite pendente antigo) — antes só gravava o `userId`.
- `JudgeFormFields` detecta email de conta pelo catálogo já carregado
  (sem endpoint novo de consulta por email: evita enumeração), mostra
  "Este email já pertence a X", vincula e trava o nome. Marca amarela
  "Aguardando conta" em jurado/programa sem `userId`.
- `EventsService.setEventLogo` só exigia o papel GLOBAL: agora exige
  admin/assessor do evento (era brecha: qualquer jurado/org trocava a
  foto de qualquer evento por `aliasId`).

**Upload de documentos do regulamento**
- `store/uploads.ts` (`trackUpload`) + `UploadStatusBanner` (renderizado
  em `App.tsx`): painel fixo com enviando/enviado/erro que sobrevive à
  navegação (o `fetch` continua depois da tela desmontar). Minimizável e
  arrastável (pointer events, posição só em memória); erro reexpande.
  Só o regulamento passa por ele (logo/avatar não).
- `useBeforeUnloadWarning` avisa ao fechar/recarregar com envio ativo.
  Texto é do navegador (não dá pra citar o arquivo) e no celular é
  pouco confiável (iOS praticamente ignora).

**Carregamento**
- `PageLoadingOverlay` + `useMinimumLoading` (mín. 500 ms, teto de 10 s
  contra travar): raio por cima de TODAS as telas de dados (config,
  Home, Perfil, Atletas, sistemas de pontuação) e mínimo nas telas ao
  vivo. EXCEÇÃO deliberada: `EventLiveScoringPage` (lançar nota) sem o
  mínimo, por causa do requisito de velocidade percebida.
- Descoberta: React Router v7 troca de tela em transição, então o
  `Suspense` de `App.tsx` NÃO mostra o fallback na navegação interna,
  só no carregamento inicial da página.

**Outros ajustes de UX**
- `main` com `overflow-y-auto` precisa ser `relative` (23 telas): sem
  isso, elementos `sr-only` (absolutos) escapam do recorte e criam um
  segundo scroll no documento.
- Menu "⋯" do evento: "Configurar evento" (→ Setup, só em `created`) e
  "Dados do evento" (popup; antes "Editar"). Botão das telas de etapa:
  "Sair". Botão do Setup: "Gerenciar equipe" (título da página idem).
- Foto do evento editável (`EventPhotoField`, compartilhado com criar);
  não dá pra remover foto (backend só troca). Sigla do evento só com
  letras/números (`\p{L}\p{N}`). Logo do menu lateral leva à Home.
- Linha inteira de Jurado de Legalidade/Head Judge abre o modal (1º
  recurso; célula de outra pista abre a dela). Painel de jurados ganhou
  o banner "Próxima etapa recomendada" (→ Setup/publicação); resumo do
  Setup mostra "Publique o evento!" com todas as etapas prontas.

**Gotchas desta rodada**
- Testar no navegador (Claude in Chrome): com a aba em segundo plano os
  `setTimeout` viram ~1 s, então loops longos estouram os 45 s do CDP —
  e o script CONTINUA rodando na página depois do erro, contaminando a
  próxima medição (esperar terminar). Hash de bundle de produção nunca
  bate com o do build local (o Cloudflare compila com `VITE_API_URL`):
  conferir por conteúdo (uma string nova), não por nome de arquivo.
- O auto mode bloqueia ler o segredo do `.env` para gerar token de
  login: teste autenticado de ponta a ponta precisa de conta de teste
  fornecida pelo usuário.
- Plano do Render confirmado pelo usuário em 2026-09-21: **Starter**
  (não Free) — ver seção "Deploy de produção" acima, item 4.
- Pendências de teste em produção: 409 de excluir tipo de dedução já
  usado (a consulta SQL nunca rodou), vínculo por email jurado/programa
  ponta a ponta, e o raio nas telas de Atletas/sistemas de pontuação.

## Evento em rascunho visível pra todo mundo ("Em breve") + código na criação + ranking por modalidade nos Resultados (2026-09-23)

Dois pedidos independentes do usuário, mesma sessão.

- **Evento `created` (rascunho) agora aparece na Home pra QUALQUER
  vínculo** (`EventMember` de qualquer papel), não só admin/assessor/
  judge — decisão do usuário: espectador/programa/atleta que já têm
  algum vínculo devem ver o card, só que como "Em breve"
  (`EventStatusIndicator`), sem conseguir abrir. `EventsService.
  findAllForUser` não filtra mais por status nem papel (só membership
  via `innerJoin`, decisão de apresentação vira 100% do frontend);
  `findOneForUser`/`canSee` (`GET /events/:id`) ficaram como estavam.
  `EventListItem`/`EventGridItem` ganharam `isStaffViewer` (deriva de
  `currentUserRoles`) pra só deixar o card clicável quando `created` E
  staff.
- **Achado um gap de segurança real durante a investigação prévia**:
  `EventMemberGuard` (rotas filhas `/events/:eventId/...` — cronograma,
  member-counts, notificações etc.) nunca checava `Event.status`, só o
  papel. Como programa/atleta já ganham `EventMember` antes da
  publicação (roster montado durante o Setup), já era tecnicamente
  possível chamar essas rotas direto num evento ainda `created` e
  pegar dado real — só a Home não linkava pra lá. Corrigido: o guard
  agora barra com 403 ("Este evento ainda não foi publicado.") quando
  `member.roles` não é staff e `event.status === created`. Sem esse
  fix, soltar a lista pra todo mundo teria virado regressão de
  segurança de verdade, não só estética.
- **`EVENT_STAFF_ROLES` unificado**: existiam 3 definições locais
  divergentes de "quem é staff" (`events.service.ts` só tinha
  `[ADMIN, JUDGE]`; `event-staff.service.ts`/`notifications.service.ts`
  já tinham `[ADMIN, ASSESSOR, JUDGE]`) — unificadas numa constante só,
  `apps/api/src/events/constants/event-staff-roles.ts`, incluindo
  `ASSESSOR` nas 3 (ele já edita configuração do evento, fazia sentido
  já enxergar rascunho antes dessa correção também). Espelhado no
  frontend em `hasEventStaffRole`/`EVENT_STAFF_ROLES`
  (`lib/eventMemberRoles.ts`).
- **`Event.eventCode` gerado na criação** (`createEvent`, dentro da
  mesma transação), não mais só na 1ª publicação — permite entrar por
  QR/código num evento ainda em rascunho (`joinByCode` não rejeita mais
  `status === created`), ganhando `SPECTATOR` e aparecendo na Home
  dele como "Em breve". `publishEvent` mantém o fallback antigo
  (gera se `eventCode` ainda for nulo) só pra evento criado antes desta
  mudança. `JoinEventPage` manda pra Home em vez de `/live/results`
  quando o evento entrado ainda está `created` (senão bateria no guard
  e voltaria sozinho, um "pulo" sem necessidade).
- Testado ponta a ponta com conta/evento descartáveis (apagados ao
  final): criar evento confirma `eventCode` já preenchido; espectador
  entra por código num evento `created`, aparece na lista dele com
  `status: created`; `GET /events/:id` e uma rota filha
  (`schedule/days`) direto como esse spectator dão 403; publicar libera
  os dois (200) pro mesmo spectator sem precisar relogar.

- **Nova aba "Por modalidade" na tela de Resultados**: ranking cruzado
  entre TODAS as categorias/níveis da MESMA modalidade (Team Cheer,
  Group Stunt, Elite Stunt/Coed, Partner Stunt, Custom — o
  `CategoryFormat` da categoria), ordenado por percentual —
  generalização do que já existia só pro card "Melhor Team Cheer"
  (`topTeamCheer`, um top-1 só), agora um ranking completo e pra
  qualquer modalidade. `ResultsPresentationView`/`ResultsPresentation`
  ganharam `categoryCustomFormatLabel` (faltava — só tinha o enum de
  formato, sem o rótulo quando `format === custom`); nova
  `ResultsModalityView`/`ResultsModality` (mesmo padrão de
  `ResultsCategoryView`, só que agrupada por `formatKey` — o próprio
  `categoryFormat`, exceto `custom` que vira `` `custom:<label>` ``,
  uma entrada por rótulo distinto). Ordem de exibição das modalidades:
  constante local `MODALITY_DISPLAY_ORDER` em `scoring.service.ts`
  (Team Cheer → Group Stunt → Coed → Partner → customs em ordem
  alfabética) — cópia local da mesma prioridade já usada em
  `AUTO_GENERATE_FORMAT_PRIORITY`/`DEFAULT_FORMAT_ORDER` (schedule/
  frontend), não importada de lá pra não acoplar `scoring` a
  `schedule` só por 4 itens.
  - Testado: `tsc` limpo nos dois lados; smoke test real contra o
    evento sandbox "Easy Judge Cup" (`GET .../scoring/results` com uma
    conta de teste promovida a admin só naquele evento via SQL, depois
    revertida — evento em si não foi tocado) confirmou o campo
    `modalities` presente e correto pro caso real disponível (Group
    Stunt, 1 categoria já pontuada). Cross-categoria (mesma modalidade,
    times de 2+ categorias diferentes juntos) e rótulo de modalidade
    `custom` distinta **não tinham cenário real pronto no sandbox**
    pra testar sem montar uma jornada grande (categoria + time +
    programa + cronograma + jurados + notas) — validado em vez disso
    isoladamente, reproduzindo a mesma função de agrupamento/ordenação
    com dados sintéticos num script Node descartável (não uma decisão
    de "pular teste", e sim de ajustar o esforço ao risco real da
    mudança, puramente lógica/determinística sobre dado já testado em
    produção).

## Bugs de layout mobile: scroll horizontal e footer flutuando (2026-09-24)

- **Scroll horizontal em "Meus eventos"**: a barra de filtros (os dois
  `Select` lado a lado) não cabia em 360px e alargava a coluna da grade
  inteira (item de grid tem `min-width: auto`). Fix: grade da página com
  `grid-cols-[minmax(0,1fr)]`, `min-w-0` nos `SelectTrigger` (rótulo
  num `<span className="truncate">`) e no card `EventGridItem` (nome
  longo com `truncate` também alargava o card).
- **Resultados**: aba "Por equipe" removida (pedido do usuário); a
  linha de abas tem rolagem horizontal própria (`overflow-x-auto
  scrollbar-none`, botões `shrink-0 whitespace-nowrap`, aba tocada vai
  pro centro via `scrollIntoView`) e o conteúdo tem `overflow-x-hidden`.
- **Footer flutuando ao abrir evento ao vivo pela Home**: todas as
  telas trocaram `h-svh` por `h-dvh` (svh é sempre a altura COM a
  barra de endereço visível; se ela recolhe, sobra espaço embaixo do
  footer). Não reproduzido com toque simulado nem no código antigo;
  confirmado pelo usuário no celular que não acontece mais.
- **Rodapé do evento ao vivo**: aba atual ganhou halo amarelo da marca
  desfocado atrás do ícone (`ActiveTabGlow` em `EventLiveShared.tsx`,
  `bg-brand-yellow/60 blur-[6px]`; com `blur-md` num círculo de 40px a
  cor se espalhava tanto que sumia no fundo branco).
- **Súmulas do jurado (mobile)**: as 4 métricas (`MetricTile`) saíram do
  `grid-cols-4` espremido pra um carrossel com rolagem própria (cards de
  `w-36`, mesmo padrão de `EventStatCards`). Na lista de súmulas
  (`AdminNotesOverviewList`) os selos (Contestação/Desistência) foram
  pra baixo do nome da equipe, que ficava cortado em "Hur…".
- **Falha de rede agora tem mensagem própria**: relato real de cadastro
  (programa sem CPF, "Não foi possível criar a conta.") investigado: API
  aceitava o payload, CORS ok, sem reinício no Render (aba Events) — só
  sobra rede do usuário (fallback genérico só aparece quando o `fetch`
  rejeita sem resposta). `apiFetch` em `api/client.ts` converte essa
  rejeição em `ApiError` status 0 com `NETWORK_ERROR_MESSAGE`, então
  toda tela mostra "Não foi possível conectar ao servidor..." sem mexer
  nelas; erro HTTP continua com a mensagem do backend. `AbortError`
  continua sendo relançado. Fluxos de conta (cadastro/login/esqueci a
  senha) ganharam `console.error` no ramo não-ApiError (bug de tela).
  Obs.: servidor fora do ar (502 do Render sem CORS) também cai nessa
  mensagem — o navegador não distingue de rede ruim.
- **Resultados e lista de súmulas lentos (N+1 sequencial)**:
  `getEventResults` fazia, por apresentação, uma consulta de súmulas
  enviadas e outra de notas, em série (~150 consultas num evento de 60
  apresentações). Agora reaproveita `findCompletedEntries` (em lote) e
  `computePresentationResults` (notas de todas as apresentações numa
  consulta; `computePresentationResult` virou um wrapper dele, a conta
  ficou em `summarizePresentationScore`); `getAdminOverview` também.
  Consultas fixas (~33) independente do tamanho. Validado comparando a
  saída JSON das duas funções antes/depois nos 3 eventos locais
  (idêntica). Render e Neon estão ambos em Oregon (us-west, confirmado
  2026-09-24).
- **Cronômetro pra qualquer jurado da pista** (antes só o de Legalidade):
  `buildScoreEventRows` separa TIMER_STARTED/TIMER_STOPPED das deduções
  e aceita de quem é Legalidade OU tem critério atribuído naquela pista
  (403 pra quem não tem nada ali); deduções continuam só Legalidade.
  Frontend mostra o bloco do cronômetro com `isLegalityJudge ||
  groups.length > 0` (mobile e `EventLiveScoringDesktopView`). Cada
  jurado tem o próprio relógio (getSheet lê só os eventos dele); o
  início da apresentação é o PRIMEIRO TIMER_STARTED de qualquer jurado
  (`getStartedPresentations` -> card "Atraso atual" e notificação
  "Apresentação iniciada"). "Acontecendo agora"/"Próxima apresentação"
  continuam pelo relógio × cronograma (não mudou nesta rodada).
  "Reiniciar" agora zera e deixa PARADO (grava TIMER_STOPPED com 0, então
  ao reabrir volta zerado só com "Iniciar"); só "Iniciar" emite
  TIMER_STARTED (`startTimer`/`resetTimer` em `EventLiveScoringPage`).
- **Convite pendente acompanha a troca de email** (programa e jurado):
  `ProgramsService.update`/`JudgesService.update` só limpavam o convite
  antigo do roster quando havia conta pra vincular
  (`syncNewlyLinked*`). Sem conta, o convite (`event_members`, sem
  `user_id`) ficava com o email antigo, quase sempre errado, e uma conta
  criada com ele herdaria o acesso. Agora, se o email mudou e não há
  conta, move o papel do email antigo pro novo (`removeMemberRole` +
  `upsertMemberRole`). Caso real: Atelopus (Batalha), convite com
  `diretoriatelopus@gmail.com` sobrou em produção. Testado com
  programa/jurado descartáveis no evento local "Teste" (apagados).
- **Filtro "Eventos especiais" no Cronograma ao vivo**: chips passaram
  a ser por categoria (`scheduleFilterCategory` em
  `lib/eventFullSchedule.ts`), não pelo tipo cru. "Eventos especiais"
  (marcado por padrão, visível pra todos) = abertura + premiação + break
  que NÃO é espera automática (almoço, batalhas, contestação,
  personalizados). "Intervalos" (oculto por padrão, só admin/assessor)
  = break com `linkedEntryId` OU com um dos 3 rótulos automáticos
  ("Aguardando aquecimento", "Aguardando disponibilidade da equipe",
  "Intervalo entre apresentações") — existem esperas sem vínculo no
  banco (dado antigo / FK SET NULL). Antes, esconder "Intervalos"
  escondia as batalhas pra quem não é staff (sem como reexibir).
- **Atleta convidado que informa o email do mesmo programa no
  cadastro**: `AuthService.setPassword` liga o convite
  (`linkUnclaimedAthleteInvitesByEmail`) e depois chama
  `createOrRequestLink(programEmail)`, que dava 409 ("já pediu vínculo")
  com a senha já salva — atleta via erro na tela de senha e não entrava,
  com a conta pronta. Agora o 409 é ignorado só no cadastro (a tela "Meus
  programas" continua avisando). Reproduzido com o código antigo e
  corrigido, com atleta descartável e o programa demo local (Hurrycane).
- **Conta criada com o tipo errado (caso real, Clara/Atelopus)**: conta
  Programa não recebe convite de atleta (só `role === ATHLETE`). Saída
  usada: a pessoa exclui a própria conta em "Meu perfil"
  (`deleteAccount` anonimiza e troca o email por
  `deleted-<id>@cheercup.invalid`, liberando o email) e recadastra como
  Atleta com o mesmo email.
- **Como depurar no celular real (Android) sem cabo**: `adb pair
  IP:PORTA CODIGO` (tela "Parear dispositivo" da Depuração por Wi-Fi —
  o `!` do Claude Code não aceita digitar o código, passar como
  argumento) + `adb connect IP:PORTA` (porta principal, diferente da de
  pareamento) + `adb forward tcp:9333 localabstract:chrome_devtools_remote`.
  `/json/list` do Chrome Android veio desatualizado (não listava a aba
  nova) e `/json/new` dá 500: usar `Target.getTargets` pelo
  `webSocketDebuggerUrl` de `/json/version` e `Runtime.evaluate` com
  sessão `flatten`. Print da tela: `adb exec-out screencap -p`. Front
  exposto com `npm run dev -- --host`. Cabo USB-C deste notebook deu
  erro -71 com dois cabos (não investigado).

## Liberação por categoria em cada dia + Setup com evento publicado (2026-09-24)

Motivo: o Batalha tem duas premiações, então notas/contestação/resultado
precisam ser liberados aos poucos. Decidido com o usuário: vale pra
qualquer evento, unidade = categoria em um dia.

- **Modelo**: tabela `category_day_releases` (`CategoryDayRelease`, uma
  linha por `schedule_day_id` + `category_id`, FK CASCADE nos dois,
  `alias_id` do evento pra busca). Sem linha = nada liberado. As 3
  colunas `events.*_released_at` ficaram OBSOLETAS (não são mais
  lidas); a migration `CreateCategoryDayReleases` copiou o valor delas
  pra todo par dia+categoria com apresentação, então eventos antigos não
  mudam. Categoria que ganha apresentação num dia novo nasce fechada.
- **`ReleasesService`** (`scoring/services/releases.service.ts`):
  `getReleaseState` (dias com apresentação → categorias com as 3
  chaves; chave do dia = "todas as categorias do dia"), `setRelease`
  (`{ dayId, categoryId? }`; sem categoria = dia inteiro), `getReleaseMap`
  e `isEntryReleased` pro resto do sistema. Regras entre as chaves
  iguais às antigas (contestação liga notas; fechar notas fecha
  contestação; resultado independente). Notificação só na transição
  fechado→liberado, com o nome das categorias no título.
  `EventsService.setReleaseFlags` foi removido.
- **Quem vê o quê**: admin/assessor/jurado sempre veem tudo (inclusive
  nos Resultados — não confundir ao testar; conta de espectador de teste
  local: `espectador.teste@cheercup.invalid`). Programa/atleta: a lista
  traz as apresentações completas com `released` (não liberada vem com
  nota zerada e aparece "Aguardando liberação", sem abrir; detalhe dá
  403); contestação por apresentação conforme a categoria no dia.
  Resultados (`getPublicEventResults` → `{ days: ResultsDayView[] }`):
  um bloco por dia; só as categorias com resultado liberado, e os
  rankings que cruzam categorias (geral, destaques, modalidade,
  programa) só com `complete` = todas as categorias do dia liberadas
  (decisão do usuário: ranking parcial pareceria final).
- **UI**: `AdminNotesOverview` agrupa as súmulas por categoria, cada uma
  com 3 chaves (`ReleaseToggles`) e "x de y súmulas completas"; topo com
  as chaves do dia. Abas por dia (Notas e Resultados) só com mais de um
  dia com apresentação, e só esses dias (`formatDayTab`). Pra admin que
  também é jurado, fica na aba "Súmulas finalizadas" (o
  `ReleaseFlagsPanel` global foi removido).
- **Exemplo local**: Easy Judge Cup ganhou apresentações no dia 14/07
  (Fenix com notas copiadas da Aurora, Tornado sem nota, Hurrycane
  Nível 2 com notas copiadas), escala copiada da pista do dia 13/07 e a
  conta de espectador acima; ids em `zz_example_ids` (script de limpeza
  no scratchpad da sessão, não versionado). O usuário pediu pra manter.
- **"Configurar evento" com evento publicado/iniciado**: menu "⋯" da
  Home mostra o item em qualquer status menos concluído, e
  `EventSetupPage` só redireciona pro ao vivo se concluído. As rotas das
  etapas nunca travaram por status (só as travas de sempre: template em
  uso, apresentação com nota). "Dados do evento" continua despublicando
  ao editar publicado, mas só o popup da Home chama essa rota.

## Avaliações do evento e da plataforma (2026-09-24)

Pedido do usuário: feedback separado do evento e da plataforma, pra um
não contaminar o outro. Só nota (1 a 5 estrelas) e comentário opcional.

- **Backend**: módulo `feedback` (tabelas próprias, migration
  `CreateFeedbacks`, só cria tabelas). `EventFeedback` (`event_feedbacks`,
  único por `alias_id`+`user_id`, editável; `PUT/GET
  /events/:id/feedback/me` pra qualquer papel do evento, a qualquer
  momento depois de publicado; quem tem papel admin/assessor NÃO avalia, mesmo
  acumulando jurado — pego no teste). `GET /events/:id/feedback`
  (admin/assessor) lista com nome, email e papéis de quem avaliou
  (decisão do usuário: o produtor vê quem avaliou). `PlatformFeedback`
  (`platform_feedbacks`, cada envio uma linha, guarda tipo da conta e
  tela de origem); `POST /feedback/platform` qualquer logado; `GET` só o
  dono da plataforma (`IMPERSONATOR_EMAIL`, mesma exceção do "ver
  como"), senão 403.
- **Frontend**: `FeedbackDialog` genérico (estrelas `StarRating` +
  comentário) usado pelos dois. "Avaliar a Cheer Cup" = ícone no rodapé
  do `AppSidebar` e do `MobileNavSheet` (`PlatformFeedbackDialog`, manda
  o path atual). Avaliação do evento: popup único `EventFeedbackHost`
  (montado no App, aberto por `useEventFeedbackStore.open(event)`;
  `canRateEvent` = publicado em diante e sem papel admin/assessor), com
  entrada no menu do evento ("Avaliar evento" abaixo de Notificações,
  `sidebarOnly` = fica fora da barra inferior mobile) e coração ao lado
  do sininho no cabeçalho mobile do Início e de Súmulas
  (`EventFeedbackHeaderButton`). Produtor vê as avaliações na
  tela Métricas do evento (`FeedbackOverview`: média, distribuição,
  lista). Dono da plataforma: ícone de caixa de entrada no rodapé do
  menu → `/admin/feedback` (`PlatformFeedbackPage`).

## Súmula fiel à árvore do sistema de pontuação (2026-09-24)

- **Causa da ordem errada**: `ScoringCriteriaService.findAllForTemplateUnchecked`
  ordena a lista inteira por `order`, que é a posição ENTRE IRMÃOS — misturava
  os níveis e os grupos saíam fora da ordem (Jump antes de Stunt). Além disso,
  o detalhe da súmula e a folha do jurado (`buildGroups`) reordenavam cada grupo
  por `order` depois de montar, intercalando subgrupos. Agora
  `sortCriteriaByTree` (pré-ordem, cada nível pelo `order`) roda em
  `loadPresentationContext`, `buildGroups` percorre essa lista, e as duas
  reordenações por `order` foram removidas. Vale pro detalhe (admin/programa/
  atleta), PDF baixado, folha do jurado e painel Head Judge.
- **Árvore inteira no detalhe**: todo critério do template aparece, mesmo sem
  jurado escalado (nota "—"); com isso a nota máxima exibida (soma dos
  critérios) passa a ser o total do template. Cada critério traz
  `subgroupPath` (subgrupos entre o grupo raiz e ele); `criteriaWithSubgroups`
  (web/lib) intercala subtítulos na tela e no PDF, com recuo por nível.
  Critério solto no primeiro nível (`isStandaloneCriterion`) vira cartão/faixa
  de uma linha, sem repetir o nome.
- **PDF**: grupos com `pageBreak: "avoid"` (não cortam entre páginas quando
  cabem numa); notas com `formatCriterionScore` (1 a 2 casas, vírgula) — antes
  `toFixed(1)` mostrava 9,25 como 9.3 e a soma das linhas não batia com o total.
- **Faixa de pontuação na súmula**: quando o critério usa faixas e tem nota,
  mostra a faixa em que a nota caiu (mesma regra da tela do jurado,
  `findMatchingBand`: sobreposição → a de início mais baixo). Tela:
  `CurrentBandBadge` embaixo do nome. PDF: coluna "Faixa" (nome na cor da
  faixa) só nos grupos em que algum critério usa faixas; no critério solto do
  primeiro nível, o nome da faixa vai em branco na própria faixa azul.
- **Exemplos locais**: no Easy Judge Cup, dia 14/07, categorias "Team Cheer All
  Star COED Nível 5 (exemplo)" (Team Cheer (Coed), Aurora, 4 jurados com
  comentários, Stunt Difficulty com 2 jurados, dedução) e "Team Cheer COED
  Non-Tumbling (exemplo subgrupos)" (template de 58 pts com subgrupos, Fenix);
  ids em `zz_example_ids`. Validado gerando o PDF real no Node (bundle do
  `presentationDetailExport` com rolldown) e convertendo com `pdftoppm`.

## Valores fixos em itens de avaliação + modelo USS na régua Level 3-5 (2026-09-24)

Pedido do usuário pro Batalha (26/09), que usa o modelo oficial USS
"Team Cheer (Coed) — Non-Tumbling" direto (sem clone).

- **Valores fixos** (`ScoringCriterion.useFixedValues`/`fixedValues`,
  jsonb `{value, name, description}`, migration
  `AddFixedValuesToScoringCriteria`): alternativa às faixas, exclusiva
  com elas (ligar um desliga o outro em `ScoringCriteriaService`).
  Validação: 2+ valores, entre 0 e `maxScore`, no máximo 1 casa decimal
  (mesma precisão de `setScoreDirect`), sem repetir, com nome; lista
  gravada em ordem crescente. Valor acima do máximo depois de baixar o
  `maxScore` deixa o template incompleto (`hasStaleFixedValues`, banner
  no builder). Ingestão de nota continua tolerante (não valida o valor
  contra a lista, mesmo motivo das deduções).
- **UI**: `FixedValuesEditor` no `EditCriterionPanel` (checkbox
  "Aceitar apenas valores fixos"); na tela do jurado
  `FixedValuePicker` troca campo +/- e slider por um botão por valor
  (mobile, desktop e Head Judge), gravando via `onSetScore` como
  sempre. Súmula (tela e PDF) mostra o nome do valor na coluna "Faixa"
  (`criterionBandForScore` em `lib/scoreBands.ts`, só quando a nota bate
  exatamente com um valor; média de vários jurados pode não bater).
- **Modelo USS** (migration `RebaseUssNonTumblingOnLevel3To5Rubric`):
  notas máximas de um clone do usuário (meta 58 -> 34) e régua do PDF
  "25-26 United Scoring Rubric Level 3-4-5 Senior & Open Coed". Stunt
  Difficulty, Stunt Max Participation, Toss e Jump Difficulty viraram
  valores fixos, TODOS com 0 ("nenhuma habilidade realizada", pedido do
  usuário); Pyramid Difficulty ficou com faixas Below Minimum/Below/Low/
  Mid/High (nomes curtos de propósito: faixas de 0,5 no slider
  sobrepunham rótulos longos). Ids dos critérios não mudam (escala de
  jurados intacta). Rodada no Neon pelo usuário antes do push.
- **Descartado**: permitir que a conta do dono (`IMPERSONATOR_EMAIL`)
  edite modelos oficiais pela tela. Chegou a ser implementado e testado,
  mas o usuário desistiu; modelos oficiais continuam só via migration.
- **Gotcha**: `apps/web` não usa Prettier (linhas longas); rodar
  `npx prettier --write` lá reformata o arquivo inteiro. Em `apps/api`
  pode.

## Ensaio do dia de operação do Batalha no Cheer Cup (2026-09-25)

Véspera do Batalha (evento oficial, 2026-09-26). O evento fictício
**Cheer Cup** em produção (aliasId `7ad7f9c9-bce8-4062-8e1b-deb5b8d9e224`)
foi remontado pra ensaiar o dia: data movida pra 25/09 (reverter
publicação, trocar `startDate`, apagar e recriar os dias do cronograma,
porque a data do dia é gravada na criação), categorias e equipes com os
5 modelos do Batalha, cronograma gerado com "Batalhas" e "Premiação",
publicado e iniciado. **O Batalha (`74298d16-...`) é só leitura pra
automação**: nenhuma escrita nele, nem por teste (ver memória
`feedback_batalha_read_only`). Tudo abaixo foi testado localmente e
está em produção (21 commits; migrations rodadas no Neon pelo usuário
antes do push).

**Acesso e sessão**
- **Telas do evento ao vivo checam só o papel no evento**, não o tipo de
  conta (pedido do usuário): `scoring`, `scoring/admin`,
  `scoring/athlete`, `scoring/team`, `scoring/entries/:id/withdraw` sem
  `@Roles` de classe; `judging/me` e `categories` GET com `@Roles()`
  vazio (sobrescreve o da classe); mover apresentação idem. Caso real:
  jurado com conta de espectador (`UserRole.ATHLETE`) tomava 403 e a
  tela dizia "não escalado". Telas de configuração continuam exigindo
  conta Jurado/Organização.
- **Sessão expirada** (`lib/sessionExpiry.ts`): o JWT dura 7 dias e o
  app só conferia se EXISTIA token (tela ficava "carregando"). 401 com a
  mensagem padrão `"Unauthorized"` encerra a sessão local (ou sai do
  "ver como"), mostra "Sua sessão expirou" no login e volta pra tela
  anterior. 401 com mensagem própria ("Senha atual incorreta.") NÃO
  desloga.
- **Tela em branco após deploy resolvida**: `main.tsx` trata
  `vite:preloadError` recarregando a página (trava de 10 s contra loop).
  Era o "risco conhecido" do code-splitting.

**Evento ao vivo: agora / próxima / atraso**
- **Sinais reais, sem relógio**: apresentação "ao vivo" = algum jurado
  deu Iniciar (primeiro `TIMER_STARTED`) e ninguém enviou súmula;
  "passou" = **primeira** súmula enviada (`getCompletedPresentationIds`
  não usa mais "todos os jurados"; isso continua só em
  `findCompletedEntries`, pra súmulas/resultados). Desistência conta
  como passada. `computeEventLiveSchedule(days, completed, started,
  startTimes)` devolve `nextIsLive`; Início e Cronograma mostram
  "Apresentando/Acontecendo agora" só nesse caso ("Próxima apresentação"
  antes). "Apresentação concluída" (notificação) sai na primeira súmula.
- **Card "Atraso atual"**: rota `scoring/presentation-starts` = primeiro
  "Iniciar" ou, sem ele, o primeiro registro do jurado; também inclui o
  início sinalizado de eventos especiais. `getStartedPresentations`
  continua só o "Iniciar". A partir de 60 min mostra "+1h 05min".
- **Início/fim de eventos especiais** (migration
  `AddSpecialEventStartEnd`: `schedule_entries.started_at/ended_at` +
  tipos `special_event_started/ended` no enum de notificação): menu ⋯ do
  Cronograma ao vivo, admin/assessor, evento iniciado, sempre com
  `ConfirmDialog` e **sem desfazer** (decisão do usuário).
  `ScheduleService.setSpecialEventSignal` aplica em todas as cópias do
  mesmo evento no dia (mesmo tipo+rótulo, uma por pista/área de
  aquecimento) e notifica "Começou: X"/"Encerrado: X". Regra de
  "passou" (`computeDoneEntryIds`): SEM sinal, quando uma apresentação
  planejada a partir dele começa ou termina (antes disso aparece "A
  seguir"); COM sinal, só quando é encerrado, quando QUALQUER
  apresentação do dia começa depois do sinal ou quando outro evento
  especial é sinalizado depois. A fila mostra só a cópia da pista de
  apresentação.
- **Gráfico "Atraso ao longo do evento"** nas Métricas
  (`lib/delayTimeline.ts` + `MetricDelayChart`, SVG próprio, cor
  `var(--chart-1)`): um ponto por apresentação/evento especial iniciado,
  horário real × atraso, pico e último ponto rotulados, tooltip ao lado
  da linha vertical, tabela, um gráfico por dia.

**Notificações e tempo real**
- **Balão de notificação** (`EventNotificationToaster`, montado no
  `App.tsx`): qualquer tela `/events/:id/live/*`; respeita o público
  (STAFF só pra admin/assessor/jurado do evento); some em 6 s; não
  aparece na tela de Notificações nem pra quem está na súmula da
  apresentação notificada. Quem dispara a ação também vê (a notificação
  não guarda o autor).
- **Notificação duplicada corrigida**: `NotificationsService.
  createOncePerEntry` faz checagem + gravação numa transação com
  `pg_advisory_xact_lock` por evento+tipo+apresentação (envios
  simultâneos da súmula passavam os dois pelo `existsForEntry`).
- **Tela de Resultados** refaz a apuração (~2 s de servidor) só quando
  muda pra quem vê: programa/atleta/espectador em "resultado liberado" e
  desistência (com atraso aleatório de até 3 s); equipe nas notificações
  de súmula e a cada 30 s.
- O Início recarrega o cronograma em notificações de evento especial,
  desistência e apresentação movida.

**Súmulas**
- **Tela de lançar nota recriada por apresentação** (`key={entryId}` em
  `EventLiveScoringPage`): trocar só o `:entryId` mantinha cronômetro,
  barra de tempo, comentário e rascunho da anterior.
- "Próxima equipe" e o avanço após "Lançar notas" pulam desistências;
  apresentação desistida mostra selo, controles bloqueados e botão
  "Próxima apresentação".
- **Subgrupos na súmula do jurado** (e Painel Head Judge): a API manda
  `subgroupPath` em cada item e a tela mostra o subtítulo (ex.: DANCE)
  com os itens recuados. Afeta todo modelo com subgrupos.
- **Pontos de cada dedução** na súmula do jurado (botões e registros),
  no detalhe da súmula e no PDF (`formatDeduction`, sempre com "-").
- Selo **"Empate"** nas súmulas do admin (mesma categoria no mesmo dia,
  mesma nota com 2 casas; desistência fora).
- Tela de súmulas do programa abre o detalhe na hora com carregamento
  (antes a lista ficava parada ~1,5 s).
- Modelo USS: "Difficulty Elements" do Dance virou **"Difficulty"**
  (migration `RenameUssDanceDifficultyElements`, só texto). Modelos
  oficiais mostram a fonte ao lado do nome ("· IASF", "· USS", "· SPPB").

**Cronograma**
- Aquecimento de apresentação desistida aparece esmaecido e com selo;
  o arquivo baixado marca "(Desistência)" no PDF (linha cinza) e numa
  coluna "Situação" no Excel.
- Desistência não inicia o evento e só é possível antes de qualquer
  registro de jurado (inclusive Iniciar ou rascunho).

**Gotchas desta rodada**
- A data de um dia do cronograma é gravada na criação
  (`startDate + dayIndex - 1`) e não acompanha a data do evento; o
  último dia não pode ser apagado.
- Apresentações de exemplo locais com id fixo
  (`22222222-0000-...`) não são UUID válido: a API recusa os registros
  de súmula (400) e eles ficam presos na fila do navegador.
- `jsPDF.save()` baixa de verdade mesmo com `HTMLAnchorElement.click`
  interceptado (usa `dispatchEvent`); pra testar sem baixar, gere com
  `output("arraybuffer")`/`output()`.
- Testes na produção por automação: a aba do usuário pode estar em "ver
  como" outra pessoa; conferir `impersonatorToken` antes de qualquer
  chamada e nunca usar o token guardado do "ver como".

## Depois do Batalha: evento concluído, início da apresentação e exclusão (2026-09-27/28)

- **Evento concluído é só para consulta** (`b71aaaf`, testado no
  navegador em 28/09): card da Home abre o ao vivo, Início não
  redireciona, telas de configuração mandam pro ao vivo (Métricas e
  Histórico abertas, `allowCompleted` em `useEventSetupGuard`; a tela de
  Programas não tinha o guard e ganhou), súmula e Head Judge travados.
- **Concluir finaliza** (decisão do usuário): `completeEvent` chama
  `emitAsync('event.completing')` ANTES de mudar o status;
  `ReleasesService.finalizeForCompletion` libera notas e resultado de
  todas as categorias em todos os dias, fecha a contestação e
  `ScheduleService.resolveAllOpenContestations` resolve as abertas. Se
  falhar, o evento continua iniciado. Precisa de
  `suppressErrors: false` no `@OnEvent` (o padrão engole o erro).
- **Trava geral**: `CompletedEventLockGuard` (APP_GUARD em
  `EventsModule`) recusa com 409 qualquer método de escrita em rota
  `/events/:id` ou `/events/:eventId/...` de evento concluído. Exceções
  (`ALLOWED_WHEN_COMPLETED`, por `MÉTODO /rota` do Nest): avaliação do
  evento, `notifications/seen` e `DELETE /events/:id`. Rota nova de
  escrita que precise funcionar depois de concluir entra nessa lista.
  Chaves de liberação aparecem travadas (`AdminNotesOverview
  eventCompleted`).
- **Início da apresentação = primeira atividade de qualquer jurado**
  (`START_SIGNAL_KINDS` em `ScoringService`: `timer_started`,
  `score_set`, `deduction_add`, `sheet_submitted`; rascunho e comentário
  não contam). Vale pra `getStartedPresentations`,
  `getPresentationStartTimes` (atraso) e as notificações "iniciada" e
  "avaliação pendente". Causa, confirmada com os dados do Batalha no
  Neon: um jurado lançava sem "Iniciar" e o outro, ~30 min atrás,
  apertava depois; esse "Iniciar" virava o primeiro (notificação,
  apresentação de volta ao vivo, atraso recalculado). Relógios dos
  celulares estavam certos (1 a 2 s entre `client_created_at` e
  `created_at`).
- **Card "Aquecendo"** usava só "súmula enviada" e ficava preso no
  aquecimento de apresentação pulada; agora segue a regra da fila
  (`allDoneEntryIds` + `livePresentationIds`). Evento concluído encerra
  todos os dias (`eventCompleted` em `computeEventLiveSchedule`).
- **Excluir evento apaga tudo**: `deleteEvent` também apaga
  `score_events` (pelos `judge_participations` do evento, o que pega
  registro de apresentação movida), notificações, `event_scoring_templates`
  e `event_feedbacks` — antes ficavam órfãos. Órfãos antigos só foram
  limpos no banco local, não em produção.
- **Apresentação pulada** (`b64c00a`) testada ponta a ponta em 28/09:
  mover com só "Iniciar" funciona; lote com cronômetro de id inexistente
  ou desistido é aceito e as notas junto são gravadas; nota nesses casos
  continua recusada. A ação "Pular" foi descartada pelo usuário.
- **Situação das súmulas** (`GET .../scoring/sheet-status`,
  `ScoringService.getSheetStatus`, sobre `loadSheetProgress`, que agora
  também alimenta `findCompletedEntries`): por dia e categoria, total,
  feitas e, das pendentes, quais jurados faltam enviar ("Ainda não
  começou" quando nenhum jurado teve atividade). Admin/assessor: todas
  as pistas; Head Judge: só as pistas em que é Head Judge (só leitura,
  `HeadJudgeSheetStatus`); jurado comum: 403. Front recarrega a cada
  30 s (o envio de cada jurado não gera notificação). Aba renomeada pra
  "Todas as súmulas" e agora também aparece pro Head Judge que não é
  admin. Categoria fechada mostra a etiqueta verde "Todas as súmulas
  enviadas".
- **Desistência fica FORA das contagens de súmula** (decisão do
  usuário, 2026-09-28): 2 enviadas + 1 desistência = "2 de 2", tanto na
  situação das súmulas quanto no "Apresentações x / y" e no "Progresso
  do dia" do jurado. Substitui a regra de `0aa955d` (desistência contava
  como concluída). Continua aparecendo na lista, com o selo.
- **Legalidade (relato da jurada Louise, Batalha)**: nada era bug de
  `requiresCode`: os tipos que ela lançou sem especificação não exigiam.
  Migration `LegalityDeductionsRequireCode` marca "Skill Performed Out
  of Level" (9 modelos oficiais + `IASF_DEFAULT_DEDUCTIONS`) e "Division
  Violation" (USS) como exigindo especificação; sistemas dos usuários
  não mudam. A especificação (`DEDUCTION_CODE_SET` mais recente) agora
  vai no detalhe da súmula (`legality.deductions[].code`) e no PDF;
  antes não chegava em lugar nenhum.
- **Editar o tempo da dedução** (`LegalityDeductionsPanel`): aceita
  "1:30", "1.30", "1 30", "130" (`parseElapsed`), salva também ao sair
  do campo, texto inválido deixa o campo aberto e vermelho (antes fechava
  em silêncio voltando ao valor antigo), Esc/✕ cancelam
  (`cancelledEditRef` evita o blur salvar). A dedução recriada mantém o
  `clientCreatedAt` original (não pula pro topo) e reenvia a
  especificação pro id novo (antes se perdia). O poll de 6 s da súmula
  junta a fila local lida antes E depois da busca.
- **Warning**: `WARNING_DEDUCTION` (`type: 'warning'`, valor 0) é
  acrescentado por `getDeductionRulesForTemplate` ao fim da lista de
  todo sistema, sem estar no template. Botão âmbar "Sem desconto",
  descrição opcional (reusa `DEDUCTION_CODE_SET`, não bloqueia envio),
  não conta pro Hit Zero (`lib/hitZero.ts`).
- **Contestação com descrição e imagens**: `POST .../team/:id/contest`
  virou multipart opcional (`description` até 1000, até 5 `images`
  JPG/PNG/WEBP/GIF de até 10 MB, `contestationImageUploadOptions`).
  Quantidade e tamanho conferidos no service (o multer só tem teto alto,
  senão responde em inglês). Imagens sobem pro storage (`contestations/`)
  só depois das checagens. Colunas novas `schedule_entries.
  contestation_description`/`contestation_attachments` (migration
  `AddContestationDetails`). `ContestationDialog` (programa) e
  `ContestationDetails` (súmula do jurado e detalhe). Pra testar upload
  local sem mandar pro R2 de produção, subir a API com as variáveis
  `R2_*` vazias (o `.env` local tem as credenciais reais).
- **Mover evento especial no Cronograma ao vivo** (menu ⋯, admin/
  assessor, antes de sinalizar início, só na cópia da pista de
  apresentação): `MovePresentationDialog` manda `moveCopies: true`;
  `ScheduleService.moveSpecialEventCopies` põe as outras cópias (outras
  pistas e áreas de aquecimento) antes do primeiro grupo que começaria
  depois do novo horário (grupo = item + esperas ligadas). Cópias via
  `findSpecialEventCopies` (mesmo tipo+nome+ocorrência, a mesma regra da
  sinalização). Passar por outro evento de mesmo nome dá 400 (trocaria as
  ocorrências). Início/fim no popup = pista inteira pra evento especial.
  Arraste do Setup continua movendo uma cópia só.
- **Sinalizar início de evento especial depois que uma apresentação
  posterior começou** é permitido de propósito (decisão do usuário,
  2026-09-28): ele volta como "Acontecendo agora" até o fim ou até algo
  começar depois do sinal.
- **Súmulas do programa (`/live/team`) no celular** tinham cabeçalho
  próprio só com "Sair" (deslogava); agora usam o mesmo cabeçalho, menu e
  barra inferior das outras telas ao vivo.
- **Gotcha de teste**: `bulk-assign` da escala só funciona em GRUPO de
  critérios; num critério folha não faz nada e responde 201. Pra
  escalar folha, `PUT .../criteria/:id/resources/:rid/judges`.

## Próximos passos (não iniciados ainda)

**Nota:** os itens antigos desta lista (lançamento de notas, jornada do
atleta/espectador, transição de status `completed`, endereçamento por
`aliasId`, tempo real via Socket.io) já foram todos feitos — ver
"Jornada do usuário" e "Status atual" acima (detalhe de como cada um
foi implementado, quando não estiver mais resumido ali, está em
`docs/CLAUDE_HISTORY.md`). Lista renumerada só com o que continua de
fato pendente:

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
3. **Atleta em qualquer conta (depois do Batalha).** Contas de jurado e
   organização poderem ser atletas de um programa (qualquer conta menos
   Programa, mesma regra do jurado). Hoje só `UserRole.ATHLETE`: "Meus
   programas" (`AthleteProgramsController` + item de menu), programa
   adicionando por email (`AthletesService`) e convite reclamado no
   cadastro (`AuthService.setPassword`). Decisão: não checar conflito de
   jurado e atleta no mesmo evento (responsabilidade do organizador).
4. **Súmula sem internet em qualquer apresentação.** Hoje só a súmula já
   aberta funciona offline (registros na fila do IndexedDB); abrir outra
   exige buscar a súmula no servidor. Ideia: guardar as súmulas do
   jurado ao abrir a tela de Súmulas. Mexe na tela mais sensível; não
   fazer em véspera de evento.

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
- **`SelectValue` (Base UI) ignora a prop `placeholder` por completo
  quando o filho é uma função** — só cai no `placeholder` quando NÃO há
  `children` nenhum. O padrão já documentado acima (`<SelectValue
  placeholder="x">{(v) => LABELS[v]}</SelectValue>`, necessário pra
  mostrar o label em vez do value bruto) faz o trigger renderizar
  VAZIO antes de escolher algo, com o `placeholder` sendo só código
  morto. Corrigido tratando `!value` dentro da própria função:
  `{(value) => value ? LABELS[value] : "Meu placeholder"}` — sem passar
  `placeholder` nenhum (2026-08-05, achado testando
  `PresentationDetailsDialog` no navegador, depois generalizado pra
  outros 6 usos do mesmo padrão no projeto — não aparece em
  typecheck/lint, só visualmente).
- **`apps/api`'s `npm run lint` roda `eslint --fix`** (não é só
  detecção) — rodar ele pra "só checar" reformata SILENCIOSAMENTE
  qualquer arquivo do projeto com pendência de estilo, mesmo arquivos
  não relacionados ao que você está tocando (pego 2026-08-05:
  reformatou ~40 arquivos, incluindo migrations antigas, ao rodar só
  pra investigar erros durante uma sessão retomada com trabalho não
  commitado de outra pessoa/sessão — teve que reverter tudo e reaplicar
  manualmente as mudanças legítimas misturadas no meio). Pra só
  verificar erros de tipo sem risco de reescrever nada, usar `npx tsc
  --noEmit -p .` (funciona de verdade em `apps/api`, diferente do
  `apps/web` — ver gotcha do `tsc -b` acima).
- **Input `type="number"` controlado direto por `number` state
  (`value={x}` + `onChange={(e) => setX(Number(e.target.value))}`)
  nunca fica vazio pro usuário apagar e digitar de novo** — apagar o
  campo manda `e.target.value === ""`, `Number("")` vira `0`, e o
  input reexibe "0" na hora, obrigando o usuário a digitar um dígito
  ANTES de conseguir apagar o zero (reportado 2026-08-05,
  `AutoGenerateDialog`; o mesmo padrão existe em pelo menos mais 6
  componentes do projeto — `CustomIntervalDialog`, `EditCriterionPanel`,
  `CategoryFormFields`, `DeductionRulesSection`, `ScoreBandsEditor`,
  `ScoringTemplateFormFields` — não corrigidos ainda, só o reportado).
  Fix: guardar o valor do input como STRING separada (aceita vazio
  livremente enquanto digita), convertendo pra number só no momento de
  usar o valor de verdade (submit), com fallback pro mínimo válido se
  ficar vazio/inválido — `ScheduleDaySettingsBar` já evitava isso desde
  sempre usando `defaultValue` (input não controlado) + `onBlur` em vez
  de `value`+`onChange`, outra forma válida de resolver o mesmo
  problema quando não precisa reagir a cada tecla.

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

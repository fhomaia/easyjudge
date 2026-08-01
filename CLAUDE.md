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

**Nota (2026-08-01):** o log detalhado de decisão/gotcha dos períodos
2026-07-12→07-19 e 2026-07-26→07-28 foi movido para
`docs/CLAUDE_HISTORY.md` (mesmo motivo de sempre: limite de 150k
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
  caracteres, gerado na 1ª publicação, estável entre republicações) +
  `POST /events/join-by-code` (sem guard de membership, concede
  `SPECTATOR` via `upsertMemberRole`, idempotente). QR renderizado no
  cliente (`qrcode.react`) codificando `${origin}/join/${eventCode}`.
  `ShareEventDialog` (admin, Setup/Home) e `JoinByCodeDialog` (header
  da Home) — este último ganhou uma aba "Escanear QR" própria (ver
  seção "Escanear QR do evento pela câmera" mais abaixo). `/join/:code`
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
- **Restrição temporária: só maiores de 18 anos — revisada pra 13 anos
  em 2026-08-01, ver seção "Idade mínima revisada de 18 para 13 anos"
  mais abaixo.** Texto original desta entrada mantido como histórico
  de decisão (era 18 na época); não usar "18" como valor atual em
  nenhum ponto do código a partir daqui. (pedido do usuário,
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

## Idade mínima revisada de 18 para 13 anos + cláusula de autodeclaração nos Termos (2026-08-01)

Pedido explícito do usuário: revisitar a restrição registrada em "Data
de nascimento, consentimento..." (2026-07-31) — não é mais 18+, é 13+.
A mitigação de não ter fluxo de consentimento de responsável legal
(LGPD art. 14) continua sendo só a autodeclaração no cadastro, agora
reforçada com uma cláusula própria nos Termos de Uso (pedida pelo
usuário com o texto já pronto). **Isso não é revisão jurídica** — o
mesmo aviso já dado sobre `TermsOfUsePage`/`PrivacyPolicyPage` em geral
(2026-07-31) se aplica aqui: permitir autocadastro de adolescentes
13-17 sem verificação real de idade nem consentimento parental é uma
decisão de produto, comunicada ao usuário em conversa, não validada
com advogado.

- **`- 18` virou `- 13`** nos 3 pontos que faziam essa conta:
  `AuthService.register` (`apps/api/src/auth/services/auth.service.ts`),
  `UsersService.updateProfile` (`apps/api/src/users/services/
  users.service.ts` — preenchimento tardio de data de nascimento no
  perfil) e `getMaxBirthDate()` (`apps/web/src/lib/birthDate.ts`, usada
  pelo `DatePicker` tanto no cadastro quanto em "Meu perfil"). Mensagens
  de erro (`"É necessário ter 18 anos ou mais..."`) e a copy do
  `RegisterDialog` ("menores de 18 anos") atualizadas junto.
- **Nova cláusula em `TermsOfUsePage.tsx`**, dentro da seção existente
  "2. Cadastro e conta" (não virou seção própria — é sobre o mesmo
  assunto, declaração no ato do cadastro): *"Ao criar uma conta, o
  usuário declara que possui 13 anos ou mais e que as informações
  fornecidas são verdadeiras. Caso seja constatado que a idade
  informada é falsa, a Cheer Cup poderá suspender ou excluir a
  conta."* (texto do usuário, só ajustado "o Cheer Cup" → "a Cheer
  Cup" pra concordância com o resto da página).
- **`PrivacyPolicyPage.tsx`, seção "6. Crianças e adolescentes"
  revisada** (não pedida explicitamente, mas necessária pra
  consistência — a seção antes só falava de atleta menor vinculado via
  `AthleteLink`, como se conta própria de adolescente não existisse):
  passou a mencionar também quem tem conta própria 13-17 anos,
  referenciando a cláusula nova dos Termos.
- `updatedAt` dos dois (`TermsOfUsePage`/`PrivacyPolicyPage`) bumped
  pra "1 de agosto de 2026".
- **Sem mudança de teste automatizado/manual nesta rodada** — a lógica
  é idêntica à de 18 anos (só o número muda), já coberta pelos testes
  via curl documentados em 2026-07-31; typecheck de `apps/api` e
  `apps/web` (`npx tsc -b --force`, ver "Gotchas" — comando certo pro
  frontend) confirmados limpos depois da mudança.

## Bug no Select de mês/ano do calendário + versionamento do aceite de Termos (2026-08-01)

Duas coisas pequenas e independentes, mesma sessão.

- **Bug real, calendário (`captionLayout="dropdown"`) com o select de
  mês/ano clicando no vazio ou aparecendo deslocado no topo da
  página** — reportado pelo usuário na tela "Meu perfil"
  (`BirthDateCard`), mas o componente é compartilhado com
  `RegisterDialog`. Dois bugs distintos, mesma área do código
  (`apps/web/src/components/ui/calendar.tsx`, arquivo que já estava
  sendo mexido numa sessão anterior — trocou o `<select>` nativo do
  react-day-picker pelo `Select` do design system, `CalendarDropdown`):
  1. **Clique não abria o select.** `nav` (os botões de mês
     anterior/próximo) é `position: absolute` cobrindo a LARGURA TODA
     do cabeçalho (`inset-x-0`, só usa `justify-between` pra ancorar os
     dois botões nas pontas) — por regra de empilhamento CSS, um
     elemento posicionado pinta por cima de um elemento estático
     (`month_caption`, onde vivem os selects) mesmo sem ter conteúdo
     visível ali, então o clique nos selects de mês/ano caía no `nav`
     invisível no meio, não nos botões do select. Confirmado via
     `elementFromPoint`. Corrigido com `pointer-events-none` no `nav` +
     `pointer-events-auto` nos dois botões de seta (só as pontas, onde
     eles realmente aparecem, continuam clicáveis).
  2. **Depois de corrigir (1), o select ATÉ abria, mas o painel
     aparecia isolado no topo da página**, bem longe do botão.
     Causa: `SelectContent` usa `alignItemWithTrigger` por padrão
     (tenta alinhar o item já selecionado exatamente sobre o gatilho)
     — esse modo do Base UI, quando o Select fica aninhado dentro de
     OUTRO Popover (o do `DatePicker`), calcula errado (confirmado via
     inspeção do DOM: o `Positioner` interno virava quase a altura
     inteira da viewport, com o painel real posicionado no topo dele
     em vez de perto da âncora). Corrigido passando
     `alignItemWithTrigger={false}` no `SelectContent` de
     `CalendarDropdown` — sem esse modo, cai no posicionamento padrão
     relativo ao gatilho, que funciona certo mesmo aninhado.
  - **Testado nos dois lugares**: `RegisterDialog` (via `127.0.0.1`,
    sessão separada/deslogada — cadastro nunca submetido) e "Meu
    perfil" na sessão REAL do usuário (`localhost`, só leitura — abrir
    o calendário e trocar mês/ano não salva nada até clicar
    "Salvar", que não foi clicado).
- **Versionamento do aceite de Termos/Privacidade** (pedido do usuário
  depois de eu apontar que faltava: `termsAcceptedAt` sozinho prova
  QUANDO alguém aceitou, não O QUÊ — se o texto mudar depois, não tem
  como provar contra qual versão o aceite foi registrado).
  `User.termsVersion` (nova coluna, `varchar` nullable, mesmo padrão de
  nullable de `termsAcceptedAt` — nulo só pra contas anteriores a esta
  coluna) + migration `AddTermsVersionToUsers`. Gravado em
  `UsersService.createPendingUser` junto com `termsAcceptedAt`, valor
  fixo `CURRENT_TERMS_VERSION = '2026-08-01'` (constante no próprio
  arquivo — formato `AAAA-MM-DD`, sortable, DIFERENTE da string de
  exibição "1 de agosto de 2026" usada em `TermsOfUsePage`/
  `PrivacyPolicyPage`; comentário no código lembra de bumpar os dois
  juntos quando o TEXTO mudar de verdade, não a cada typo). Um único
  checkbox no cadastro cobre os dois documentos (Termos + Privacidade)
  — por isso uma versão só, não duas colunas separadas. Não exposto em
  `UsersController.serializeProfile` (mesmo tratamento que
  `termsAcceptedAt` já tinha — nenhum dos dois aparece na resposta de
  `/users/me`, é dado de auditoria interna, não de UI).
  - **Testado via curl** com uma conta descartável
    (`teste.termsversion+claude@example.com`, deletada do Postgres
    local ao final): confirmado via SQL direto que `terms_version`
    grava `2026-08-01` corretamente. O `POST /auth/register` em si
    devolveu `500` — mas era o envio do email de verificação real via
    Resend falhando pro domínio fictício `example.com` (não relacionado
    a esta mudança; o `INSERT` do usuário, incluindo `terms_version`,
    já tinha sido persistido com sucesso ANTES desse 500, mesmo padrão
    "escrita 1 ok, escrita 2 falha depois, sem transação cobrindo as
    duas" já documentado antes neste arquivo pra `EventActivityAction`).

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

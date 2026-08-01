# easyJudge — Histórico detalhado (2026-07-12 a 2026-07-19)

**O que é este arquivo:** log cronológico de decisão/gotcha, feature a
feature, do período em que os módulos `events`, `categories`, `teams`,
`scoring-templates`, `regulations`, `programs`, `judges`, `judging`,
`schedule` e `event-staff` foram construídos (mais o redesenho visual
de login/cadastro/home). Foi movido do `CLAUDE.md` principal em
2026-07-28 porque o `CLAUDE.md` passou do limite de 150k caracteres
suportado como instrução de projeto — este arquivo **não é carregado
automaticamente** como contexto; consulte sob demanda quando precisar
entender o "porquê" de uma decisão antiga que não está mais detalhada
no `CLAUDE.md`.

O estado ATUAL da arquitetura (estrutura de pastas, stack, módulos
existentes) continua descrito no `CLAUDE.md` — este arquivo é só o
histórico de como se chegou lá. O período seguinte (2026-07-26 a
2026-07-28 — desistência de apresentação, aliasId nas rotas HTTP,
ciclo de vida do evento, mover apresentação, faixas de pontuação,
trava de template em uso, etc.) foi movido pra cá em 2026-08-01, pelo
mesmo motivo (limite de 150k caracteres) — ver seção própria mais
abaixo. Do que ficou pendente entre essas duas janelas (2026-07-19 a
2026-07-26), não existe log detalhado — ver nota no topo do
`CLAUDE.md` atual.

---

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

---

# Histórico detalhado (2026-07-26 a 2026-07-28)

**O que é esta seção:** continuação do log acima, cobrindo o fluxo de
desistência de apresentação, o endereçamento por `aliasId` nas rotas
HTTP, os ajustes no ciclo de vida do evento, mover apresentação durante
o evento ao vivo, faixas de pontuação no sistema de pontuação, e a
rodada de "pendências resolvidas" de 2026-07-28. Movido do `CLAUDE.md`
principal em 2026-08-01, mesmo motivo de sempre (limite de 150k
caracteres). O resumo do que existe hoje (Fluxo de desistência,
aliasId, ciclo de vida do evento, mover apresentação, faixas de
pontuação) continua em "Status atual" do `CLAUDE.md` — aqui é só o
detalhamento de decisão/gotcha de como se chegou lá.

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


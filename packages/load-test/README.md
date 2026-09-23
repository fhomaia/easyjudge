# load-test

Ferramenta descartável de teste de carga: simula N espectadores entrando
no painel "evento ao vivo" ao mesmo tempo (conexão Socket.io + as
leituras REST que a tela faz ao abrir), depois dispara um broadcast real
(`POST /events/:id/start`) e mede quanto tempo leva pra chegar em todo
mundo. Cria e apaga todo o próprio dado de teste (evento, usuários,
vínculos) — nunca toca em evento ou conta real.

## Uso local (contra `docker compose up -d` + `npm run start:dev` da API)

```bash
cd packages/load-test
npm install
npm run spectators
```

Sem nenhuma variável de ambiente, já funciona: usa `http://localhost:3000`,
o Postgres do `docker-compose.yml` da raiz, e lê `JWT_SECRET` do
`apps/api/.env` do próprio repo.

## Variáveis (todas opcionais)

| Variável | Padrão | O que é |
|---|---|---|
| `SPECTATOR_COUNT` | `200` | Quantos espectadores simular |
| `RAMP_UP_SECONDS` | `10` | Janela pra todo mundo conectar (0 = rajada instantânea) |
| `HOLD_SECONDS` | `3` | Espera depois de todo mundo conectado, antes do broadcast |
| `BROADCAST_TIMEOUT_SECONDS` | `15` | Quanto esperar o broadcast chegar em todo mundo |
| `LOAD_TEST_API_URL` | `http://localhost:3000` | API alvo |
| `LOAD_TEST_DATABASE_URL` | Postgres local do compose | Banco alvo (só pra criar/apagar o dado de teste) |
| `LOAD_TEST_JWT_SECRET` | `JWT_SECRET` do `apps/api/.env` | Segredo pra assinar token dos usuários de teste — **precisa ser o mesmo do ambiente alvo** |

## Rodar contra outro ambiente (staging/produção)

Só se você tiver acesso direto às credenciais desse ambiente (o script
nunca lê nem infere segredo de produção sozinho — sem essas 3 variáveis
setadas, ele sempre aponta pro ambiente local):

```bash
LOAD_TEST_API_URL=https://api.cheercup.com.br \
LOAD_TEST_DATABASE_URL="<connection string do Neon>" \
LOAD_TEST_JWT_SECRET="<JWT_SECRET configurado no Render>" \
npm run spectators
```

Cuidado: isso cria carga de verdade na infraestrutura de produção
(Render + Neon) e usuários/evento descartáveis que são apagados ao
final — rodar num horário de baixo uso e observar os dashboards do
Render/Neon durante o teste.

## O que o resultado mostra

- **Conexão (socket)**: quanto tempo cada espectador levou pra abrir a
  conexão Socket.io e entrar na sala do evento.
- **Leitura REST**: latência de `GET /events/:id`, `.../schedule/days` e
  `.../scoring/results` (as mesmas chamadas que a Home/painel ao vivo
  fazem ao abrir), sob concorrência.
- **Broadcast**: tempo entre o `POST /events/:id/start` responder e cada
  socket receber o `event.status_changed` correspondente — mede o
  fan-out do Socket.io pra sala inteira, o ponto mais provável de sofrer
  com muita gente conectada ao mesmo tempo.

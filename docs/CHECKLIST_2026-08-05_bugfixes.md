# Checklist de conferência — bugs e ajustes relatados em 2026-08-04/05

Lista de tudo que foi relatado nas sessões de 2026-08-04 e 2026-08-05, pra
conferir um a um no app de verdade. Marque `[x]` conforme for validando;
se algo não estiver certo, é só reportar de novo apontando pra este item.

## Tela de login / sidebar / setup geral

- [ ] Tela inicial (login) ganhou scroll indevido em paisagem no tablet —
      corrigido o intervalo de altura que herdava o espaçamento errado.
- [ ] Preview de imagem quebrada ao criar evento (aparecia quebrada até
      redirecionar pra listagem) — trocado pra `data:` URL.
- [ ] Botão pra colapsar a sidebar de desktop — adicionado (seta na borda,
      preferência salva entre navegações).
- [ ] Setup do evento cortado no tablet — corrigido overflow horizontal
      no card "Progresso da configuração".
- [ ] Card de etapa do Setup: clique em qualquer lugar do card deve abrir
      a tela (não só no botão) — corrigido.
- [ ] Banner "próxima etapa recomendada" adicionado na página de
      Categorias (igual ao de Regulamentos).
- [ ] Banner "próxima etapa recomendada" adicionado na página de
      Programas (igual ao de Regulamentos).
- [ ] Animação (raio) não tocava ao publicar o evento — corrigido (evento
      estava sendo abandonado antes da animação rodar).

## Sistemas de pontuação / Categorias

- [ ] Lista de sistemas de pontuação (tela de Regulamento): clicar num
      item da lista deve selecioná-lo, não navegar pra página do
      template — corrigido.
- [ ] Nome da categoria deve atualizar sozinho ao trocar o formato, na
      edição — corrigido.
- [ ] Remover `templates@cheercup.com.br` (conta interna de sistema) da
      lista de seleção de jurados — corrigido.

## Programas e equipes

- [ ] Input de UF no cadastro de programa: limitar a 2 caracteres —
      já estava certo no formulário principal; reforçado também no
      preenchimento automático via "programa já conhecido".
- [ ] Impedir cadastro de dois programas iguais no mesmo evento —
      corrigido (continua permitindo reaproveitar o mesmo programa em
      OUTRO evento).
- [ ] Critério de conclusão da etapa "Programas e equipes" no Setup:
      agora exige equipe em categoria + nenhum programa/equipe órfão.
- [ ] Bug real: criar uma equipe quebrava a página inteira (conteúdo
      sumia) — corrigido (backend não devolvia a lista de categorias da
      equipe recém-criada/editada).

## Cronograma (Setup)

- [ ] Tablet: área da timeline muito pequena, prefiro maior com scroll —
      corrigido (timeline ganhou altura mínima generosa).
- [ ] Tablet: drag-and-drop não funcionava bem — corrigido
      (`touch-action` que faltava nos itens arrastáveis).
- [ ] Tablet: não conseguia excluir uma apresentação já agendada —
      corrigido (o "X" só aparecia no hover do mouse, que não existe em
      touch; agora fica sempre visível).
- [ ] Popup de "gerar automaticamente": faltava o campo de intervalo
      entre apresentações — adicionado.
- [ ] Popup de "gerar automaticamente": não incluía o intervalo de
      almoço em alguns casos — bug real corrigido (pista que terminava
      as apresentações antes do horário do almoço perdia o intervalo
      inteiro).

## Painel de jurados (Setup)

- [ ] Delay entre soltar um jurado (drag-and-drop) e ele aparecer
      atribuído na tela — corrigido (atualização otimista).
- [ ] Popup de "substituir ou adicionar jurados" nem sempre aparecia ao
      soltar num item de avaliação já atribuído — corrigido (era o mesmo
      delay acima causando leitura de dado desatualizado).

## Evento ao vivo — tela de Início

- [ ] Botão "Compartilhar evento" adicionado na tela de Início (ao lado
      do menu "⋯", não dentro dele) — igual ao que já existe na
      listagem de eventos.
- [ ] Nome da categoria ultrapassando os cards "Próxima apresentação" /
      "Aquecendo" / "Agora em cada pista" — corrigido (quebra em até 2
      linhas em vez de estourar).
- [ ] Card "Agora em cada pista" não deve mostrar "Intervalo entre
      apresentações" como o que está acontecendo — corrigido (pula
      direto pro próximo item de verdade).

## Evento ao vivo — Cronograma (mobile)

- [ ] Mobile, evento em produção: não dava mais pra fazer scroll
      vertical pra ver o resto do cronograma — bug real corrigido
      (cabeçalho grande + filtros podiam ocupar a tela toda num celular
      pequeno, sem nenhuma forma de rolar até o resto).

## Compartilhar evento (popup)

- [ ] Mobile: botão "Copiar código" estourava a própria borda —
      corrigido (botões empilham em 1 coluna no mobile em vez de 2).

---

**Como testar**: a maioria dessas telas fica em `/events/:id/setup`,
`/events/:id/categories`, `/events/:id/programs`, `/events/:id/schedule`,
`/events/:id/judging` (todas desktop) e `/events/:id/live/*` (mobile-first,
mas também têm layout desktop). Os itens de tablet valem a pena conferir
num tablet de verdade ou no DevTools do navegador com o dispositivo
simulado (paisagem e retrato).

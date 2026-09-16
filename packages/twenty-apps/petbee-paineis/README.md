# Painéis Petbee

Painéis comerciais do CRM declarados em código, em vez de montados clicando na tela.

## Por que um app separado do `petbee-cadencia`

O `petbee-cadencia` tem quatro logic functions que **escrevem** no CRM e governam a
régua de follow-up. Cada `yarn twenty dev` naquele app toca uma automação em produção.

Painel é leitura. Misturar os dois significaria que publicar um gráfico novo passa
pelo mesmo deploy que a cadência — e um erro de painel poderia derrubar a régua.

Separado, o pior caso de um deploy daqui é um gráfico errado. Nada mais.

O papel deste app (`src/default-role.ts`) é **somente leitura**, de propósito: ele não
tem permissão de escrita nenhuma, então não consegue alterar um negócio nem por bug.

## O que ele cria

Um dashboard chamado **Painel Comercial**, com duas abas:

| Aba | Conteúdo |
|---|---|
| **Comercial** | 6 números (criados, vendas, receita, ticket, conversão, sem origem), 2 linhas do tempo por dia, 6 barras por origem / canal / vendedor |
| **Por período** | Quadro próprio com seletor de datas (este mês, mês passado, 7 dias, 30 dias, desde 01/09, ou De/Até livre). v0: negócios criados e vendas |
| **Vendedores** | 4 números de pipeline, pipeline por dono, vendas por vendedor, pipeline por etapa e dono (empilhado), motivos de perda |

### Por que a aba "Por período" é um componente e não gráfico nativo

Gráfico nativo só lê o filtro gravado nele mesmo: não existe filtro de data da página
inteira, nem por variável, nem por aba. O único caminho é um **front component**
(`src/components/painel-periodo.front-component.tsx`) que pergunta ao GraphQL do CRM
com o período que a pessoa escolheu. Ele roda no navegador, dentro de um worker, com
o token do app (somente leitura) injetado pelo runtime, do mesmo jeito que a régua da
cadência faz.

Cresce em fatias: v0 dois números → v1 os seis números → v2 barras → v3 funil por
histórico de etapa (a linha do tempo, que gráfico nativo não abre).

## As três regras de filtro

Estão em `src/page-layouts/comercial.page-layout.ts`, no topo, e valem para tudo:

- **Lead** → `Funil = Vendas` + `Data de criação` é **este mês**
- **Venda** → `Funil = Vendas` + `Etapa = Won` + `Data de fechamento` é **este mês**
- **Pipeline** → `Funil = Vendas` + `Etapa ≠ Won, Lost` — **sem data**, porque pipeline é foto de agora

"Este mês" é relativo: no dia 1 o painel zera sozinho e passa a mostrar o mês novo.
Ninguém precisa editar corte. Para olhar mês passado ou um intervalo qualquer, é o
seletor de período do quadro próprio (front component), que está sendo construído.

Contou lead, usa data de criação. Contou venda, usa data de fechamento. Trocar os dois
é o erro mais fácil de cometer e o mais difícil de perceber: os totais continuam
plausíveis. Já aconteceu três vezes durante a montagem manual.

## Detalhes que custaram para descobrir

- **Filtro de lista** grava o valor como array JSON em texto: `'["WON"]'`.
- **Filtro de data relativo** grava texto no formato `THIS_1_MONTH;;America/Sao_Paulo;;MONDAY;;`
  com operando `IS_RELATIVE`. O fuso dentro do texto é o que define onde o mês começa.
  (Data fixa, se um dia voltar, é operando `IS_AFTER` e ISO puro: `'2026-09-01T03:00:00.000Z'`.)
- **`timezone` fixo em `America/Sao_Paulo`** em todo gráfico. Sem isso o CRM agrupa pelo
  fuso de quem está olhando e duas pessoas veem dias diferentes.
- **"Contar todos" ignora o campo escolhido** — conta registros. O campo `name` é usado
  só porque precisa de algum.
- **Gráfico de campo de lista não desenha o vazio.** Por isso existe o número
  "Sem origem" ao lado: são ~70 negócios que nenhuma barra de origem mostra.
- **Gráfico de campo de relação desenha o vazio** como "Not Set" — o `Owner` aparece.
- Cada widget com filtro tem um **id de grupo fixo** em `FG`. Se fosse gerado a cada
  build, toda sincronização duplicaria os filtros.

## Como publicar

**Na VPS**, pelo script, igual à cadência. A VPS tem Node 18 e não tem yarn, então o
script roda tudo num container `node:22` descartável e lê a chave de
`petbee/sync/.env` — ninguém digita credencial.

```bash
cd /opt/twenty-repo/petbee/deploy
./publicar-paineis.sh          # PLANO: mostra o que mudaria, não escreve nada
./publicar-paineis.sh apply    # publica de verdade
```

O código chega na VPS pelo `deploy.yml`, que roda a cada push na `main`. Como a produção
usa imagem pronta (`twentycrm/twenty:${TAG}`) e não compila do fonte, um merge que só
adiciona pasta de app é praticamente no-op para os contêineres.

Ele cria um dashboard **novo**, com nome diferente do "Comercial" montado à mão. Os dois
convivem: compare lado a lado e apague o manual só quando estiver satisfeito.

Para desfazer, apague o dashboard pela tela. Nada aqui altera negócio — o papel do app
não tem permissão de escrita.

### Rodar da máquina local, se preferir

Funciona também, desde que a máquina tenha Node 22+ e o remote `petbee` configurado
(a credencial do CLI fica em `~/.twenty/config.json`, global por máquina):

```bash
cd packages/twenty-apps/petbee-paineis
yarn install && yarn typecheck
yarn twenty plan
yarn twenty apply
```

## Conferência

Números medidos pela API em 16/09/2026. Em setembro "este mês" e "a partir de 01/09"
dão o mesmo resultado, então servem para conferir a versão relativa:

| | |
|---|---|
| Negócios criados | 369 |
| Vendas | 27 |
| Receita | R$ 4.062,20 |
| Ticket médio | R$ 150,45 |
| Conversão | 7,3% |
| Sem origem | 70 |
| Negócios em aberto | 256 |
| Sem dono | 32 |
| Em negociação | 75 |
| Perdas com conversa | 39 |

As barras de origem e canal somam **menos** que o total, porque o vazio não desenha:
origem mostra 299 de 369, canal mostra 364 de 369.

## O que ainda não está aqui

O funil por histórico de etapa. A linha do tempo do CRM guarda cada mudança em
`properties` (JSON), mas gráfico nativo não abre JSON. Isso pede um front component
com uma logic function agregando no servidor — próxima etapa, não esta.

Dado levantado pela API: das 35 transições para Ganho em setembro, **23 vieram direto
de "Novo Lead"** e só 7 de "Em negociação". A maior parte das vendas não passa pelo funil.

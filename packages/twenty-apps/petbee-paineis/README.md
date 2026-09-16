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
| **Vendedores** | 4 números de pipeline, pipeline por dono, vendas por vendedor, pipeline por etapa e dono (empilhado), motivos de perda |

## As três regras de filtro

Estão em `src/page-layouts/comercial.page-layout.ts`, no topo, e valem para tudo:

- **Lead** → `Funil = Vendas` + `Data de criação` a partir de 01/09/2026
- **Venda** → `Funil = Vendas` + `Etapa = Won` + `Data de fechamento` a partir de 01/09/2026
- **Pipeline** → `Funil = Vendas` + `Etapa ≠ Won, Lost` — **sem data**, porque pipeline é foto de agora

Contou lead, usa data de criação. Contou venda, usa data de fechamento. Trocar os dois
é o erro mais fácil de cometer e o mais difícil de perceber: os totais continuam
plausíveis. Já aconteceu três vezes durante a montagem manual.

## Detalhes que custaram para descobrir

- **Filtro de lista** grava o valor como array JSON em texto: `'["WON"]'`.
- **Filtro de data** grava ISO puro: `'2026-09-01T03:00:00.000Z'` — 01/09 00:00 de Brasília.
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

Na mesma máquina de onde o `petbee-cadencia` é publicado. A credencial do CRM fica em
`~/.twenty/config.json`, global por máquina — se o remote `petbee` já existe ali, não
precisa informar chave nenhuma de novo.

```bash
cd packages/twenty-apps/petbee-paineis
yarn install
yarn typecheck    # confere o código antes de falar com o CRM

yarn twenty plan  # mostra o que SERIA criado, sem aplicar nada
yarn twenty apply # cria de verdade
```

Se o remote ainda não existir nesta máquina:

```bash
yarn twenty remote:add --url https://crm.petbeetools.com.br --api-key $TWENTY_API_KEY --as petbee
```

Ele cria um dashboard **novo**, com nome diferente do "Comercial" montado à mão. Os dois
convivem: compare lado a lado e apague o manual só quando estiver satisfeito.

Para desfazer: `yarn twenty apply` depois de remover o arquivo do page layout, ou apague
o dashboard pela tela. Nada aqui altera negócio — o papel do app é somente leitura.

## Conferência

Números medidos pela API em 16/09/2026, corte 01/09:

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

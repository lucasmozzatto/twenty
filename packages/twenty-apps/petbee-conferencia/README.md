# Conferência Petbee

Conferência entre o funil de vendas do CRM e o banco da Petbee, declarada em
código, com seletor de período e passo de mês em mês.

## O objetivo

Fechar o mês com os dois lados iguais: cada venda ganha no CRM precisa ter a
assinatura correspondente no banco, com o mesmo valor, e cada assinatura nova
no banco precisa ter a venda ganha no CRM. Quando a diferença é zero e nada
está pendente, o mês bate. A base é setembro de 2026 em diante; agosto ficou
como estava (ver "Agosto").

Quem **julga** cada venda e cada assinatura é a conciliação diária no n8n
("Conciliação diária — funil × banco", 07:00 de Curitiba). Esta página **só
mostra** o que ela gravou, por período, com totais, tabela por vendedor e as
listas para agir.

## Por que um app separado do `petbee-paineis`

Mesmo argumento que separou o painéis da cadência: papel próprio (somente
leitura), deploy próprio, um erro aqui não derruba o Painel Comercial. E mais
dois motivos:

- **Propósito diferente.** O Painel Comercial é análise; a Conferência é
  checklist operacional, com linha por registro e link para corrigir.
- **Trabalho em paralelo sem conflito.** Pasta nova em `packages/twenty-apps/`,
  script novo em `petbee/deploy/`, identificadores universais novos. Nenhum
  arquivo em comum com o painéis, então as duas branches sobem sem uma
  estragar a outra. Publicar um app não toca no outro: o `twenty apply` só mexe
  no que pertence ao próprio app.

O custo é copiar as peças pequenas e puras do painéis (datas, seletor, tema,
formato, cartões e o cliente do GraphQL), com os mesmos nomes de arquivo. Se
um dia a Conferência virar uma visão dentro do Painel Comercial, é mover
arquivos, porque as convenções são as mesmas: arquivos abaixo de 300 linhas,
`src/painel/`, nomes em português.

## O que ele cria

Uma página **Conferência** no menu lateral (logo abaixo do Painel Comercial),
com uma aba só, **Funil × banco**, e um quadro com:

| Parte | Conteúdo |
|---|---|
| Seletor | Este mês, Mês passado, Últimos 7 dias, Últimos 30 dias, De/Até livre, e as setas **◀ mês** / **mês ▶** para andar um mês de cada vez |
| Resumo | vendas, receita e valor no banco das vendas do CRM, e a diferença entre os dois; assinaturas e MRR do banco; e os vereditos: conferidas, valor divergente, sem assinatura, sem venda no funil, aguardando |
| Por vendedor | vendas, receita CRM, valor no banco e vendas por veredito, por dono atual do negócio, com total |
| Vendas × banco | uma linha por negócio ganho, com valor CRM, valor no banco, diferença e veredito; etiqueta **duplicado** quando o cliente tem mais de um negócio ganho no período; abre em "Com pendência" |
| Assinaturas do banco | uma linha por assinatura iniciada no período, com tutor, MRR, status e veredito; abre em "Sem venda" |

Clicar no cliente abre o negócio; no pet, a assinatura; no tutor, a pessoa.
As listas crescem de 40 em 40, porque o quadro tem altura fixa na grade.

**Diferença** é receita do CRM menos o valor no banco das mesmas vendas, ou
seja, a soma da coluna "Diferença" da lista de vendas. Venda sem assinatura
casada entra com zero no banco e pesa inteira. Comparar com o MRR de todas as
assinaturas do mês, como era antes, misturava assinatura sem venda na conta e
o número não apontava para nada.

## As duas regras de filtro

Estão em `src/painel/dados.ts` e valem para tudo:

- **Venda** → Etapa = Ganho + **data de fechamento** dentro do período, em
  qualquer funil.
- **Assinatura** → **data de início** dentro do período, em qualquer status.

Fechamento, e não criação, de propósito: a venda acontece quando fecha. Um
negócio criado em agosto e ganho em setembro é venda de setembro. Qualquer
funil e qualquer status porque a pergunta é "o que existe de cada lado"; as
fichas da tela recortam depois. Assinatura de valor zero aparece na lista mas
fica fora da conta de dinheiro; a marca "cortesia" do banco com valor cobrado
é assinatura normal, igual à conciliação.

**Data de fechamento "só data".** Boa parte dos negócios (97 de 159 em 17/09)
tem o fechamento gravado como data sem hora, meia-noite UTC, que é como a
inbox grava ao marcar Ganho. Passar isso pelo fuso de Brasília devolve 21:00
do dia anterior, e uma venda do dia 1º cairia no mês errado. Por isso
`diaCivil` (em `periodo.ts`) lê valor à meia-noite UTC como a própria data e
só converte para Brasília o que tem hora de verdade; a busca começa 3 horas
antes do período e recorta pelo dia civil. A conciliação lê do mesmo jeito. O
checkout grava a hora do pagamento, então o problema é só de quem grava data
pura.

## De onde vêm os vereditos

Dos campos que a conciliação diária grava: **Conferência banco** no negócio
(Conferida / Valor divergente / Sem assinatura, com o **Valor no banco**) e
**Conferência funil** na assinatura (Com venda / Sem venda / Cortesia). A regra
dela, no nó "Cruzar e decidir", desde 17/09/2026:

- casa por pessoa (ponto de contato do negócio = tutor da assinatura), com a
  assinatura começando até **15 dias antes** da **data de fechamento** do
  negócio ou até **7 dias depois** (cliente que assina antes de o vendedor
  fechar o card, ou logo depois);
- venda sem assinatura casada é "Sem assinatura"; soma das assinaturas igual
  ao Amount (tolerância de um centavo) é "Conferida"; senão "Valor divergente";
  assinatura cancelada fica fora da soma quando há ativa na janela;
- assinatura de valor zero é "Cortesia"; com venda ganha do mesmo tutor na
  janela é "Com venda"; senão "Sem venda". A marca "cortesia" do banco não
  entra na decisão: só o valor manda;
- julga só o que fechou ou começou a partir de **01/09/2026** e nos últimos 23
  dias; busca vendas ganhas fechadas nos últimos 30 dias e assinaturas
  iniciadas nos últimos 38 dias, e falha alto se qualquer busca bater o teto
  de 200 registros.

Antes de 17/09 a regra casava pela data de **criação** do negócio, com janela
de 7 dias, e só buscava negócios criados nos últimos 30 dias. Era isso que
deixava venda de negócio antigo em "Aguardando" para sempre e criava falso
"Sem assinatura" (Rita Rojas, Katia Gomes, Audrey Ignatowicz em setembro).

"Aguardando conciliação" não é valor do campo: é o vazio, quando a conciliação
ainda não passou por aquele registro.

## O botão "atualizar"

Ele roda a conciliação na hora e só então relê a página. É o caminho para
corrigir um negócio no CRM e ver o veredito mudar em segundos, em vez de
esperar as 07:00. Trocar de período **não** dispara a conciliação de
propósito: navegar pelos meses não precisa acordar o robô.

O caminho da chamada, do clique até o veredito:

1. a página chama `POST /s/conferencia/conciliar` no próprio CRM, com o token
   do app, e a rota exige estar logado;
2. essa rota é a função de servidor `src/logic-functions/conciliar.ts`, que lê
   as variáveis `CONFERENCIA_CONCILIACAO_URL` e `CONFERENCIA_CONCILIACAO_CHAVE`
   (só o servidor as recebe decifradas) e chama o webhook do n8n;
3. no n8n, o nó "Conferir a chave do botão" recusa quem não trouxer a chave, e
   a conciliação roda igual à das 07:00;
4. o webhook só responde quando a rodada termina, então a página relê e já vê
   os vereditos novos.

A página nunca vê a URL nem a chave do robô: quem as guarda é o servidor. O
caminho do webhook é um UUID, e a chave é a segunda tranca, para uma URL
vazada sozinha não bastar. Com as variáveis vazias o botão volta a ser um
"reler" e a página avisa, em vez de fingir que rodou.

O que o botão **não** faz é rodar o sync do banco da Petbee, que é um cron no
próprio servidor do CRM (ver `petbee/sync`). Correção feita na Petbee aparece
na próxima rodada do sync; correção feita no CRM, que é o caso comum, o botão
resolve na hora.

## Agosto

Agosto ficou com os vereditos da regra antiga, de propósito: a base da
conferência é setembro em diante. Então "Mês passado" mostra 77 vendas em
"Aguardando" e 82 assinaturas em "Sem venda" que não são pendência de verdade,
e 25 pares de negócios ganhos duplicados (17 deles criados num lote em 28/08,
cópias de cartões que o checkout já tinha criado). O teste sem gravar de
17/09 (workflow "Conciliação (teste, sem gravar) — fechamento", inativo no
n8n) mostrou que a regra nova sobre agosto tira todos os "Aguardando" e deixa
3 vendas sem assinatura e 43 divergências de valor, quase todas de R$ 10 por
pet a mais no CRM. Se um dia agosto precisar bater, é limpar os duplicados e
rodar a conciliação com `INICIO_JULGAMENTO` em 01/08.

## Por vendedor

Por **dono atual** do negócio, como no Painel Comercial: negócio repassado
conta para quem está com ele hoje. "No banco" é a soma do Valor no banco das
vendas daquela pessoa, ou seja, o que a conciliação encontrou nas assinaturas
dos clientes dela. O banco não sabe quem vendeu; a ponte é o negócio.

## Acesso

Quem pode abrir a página vem de dois lugares, em `src/painel/acesso.ts`:

1. **A variável do app `CONFERENCIA_LIBERADO_PARA`**, se o CRM entregar o valor
   legível: `todos` (padrão) ou e-mails separados por vírgula, editável em
   Settings → Applications → Conferência Petbee, sem republicar.
2. **A lista `LIBERADOS_NO_CODIGO`**, quando a variável não vem legível ou está
   vazia. Vazia = todos. Mudar exige republicar o app.

**Hoje quem manda é a lista no código.** Nesta versão do CRM o valor de toda
variável de app é gravado cifrado (`enc:v2:…`) e o componente de tela o recebe
assim, sem decifrar; só as funções de servidor recebem decifrado. Foi o que fez
a página abrir em "Sem acesso" no primeiro publish (17/09/2026): o texto
cifrado foi lido como lista de e-mails. Agora valor cifrado conta como
ilegível, e a lista do código vale. Quando o CRM passar a decifrar para a tela,
a variável passa a valer sem mexer no código.

Quem não está na lista vê "Sem acesso". Isso **esconde a página, não tranca o
dado**: o que o painel busca vem com o token do app, e o servidor aplica o
papel do app (somente leitura, lê tudo), não o papel de quem olha. Qualquer
membro logado consegue pedir esse token pela API. Serve para tirar da frente de
quem não precisa, que é o caso comum. Se um dia houver membro que não pode ler
negócios ou assinaturas, o papel do app precisa ser estreitado em
`src/default-role.ts` (`objectPermissions`).

## Como publicar

**Na VPS**, pelo script, igual ao painéis:

```bash
cd /opt/twenty-repo/petbee/deploy
./publicar-conferencia.sh            # PLANO: mostra o que mudaria, não escreve nada
./publicar-conferencia.sh apply      # publica de verdade, sem apagar nada
./publicar-conferencia.sh remover    # publica APAGANDO o que saiu do código
```

O código chega na VPS pelo `deploy.yml`, a cada push na `main`. Para desfazer,
`remover`, ou apague o app em Settings → Applications. Nada aqui altera
registro: o papel do app não tem permissão de escrita.

Depois do primeiro `apply`, preencher em **Settings → Applications →
Conferência Petbee** as duas variáveis do botão "atualizar":
`CONFERENCIA_CONCILIACAO_URL` com a URL de produção do webhook "Botão da
Conferência" (no n8n, dentro da "Conciliação diária — funil × banco") e
`CONFERENCIA_CONCILIACAO_CHAVE` com a chave que está no nó "Conferir a chave
do botão". As duas são segredo e não têm valor no código de propósito. O
workflow precisa estar **publicado** no n8n para a URL de produção responder.

Da máquina local, com Node 22+ e o remote `petbee` configurado:

```bash
cd packages/twenty-apps/petbee-conferencia
yarn install && yarn typecheck
yarn twenty plan
yarn twenty apply
```

## Conferência dos números

Medidos pela API em 17/09/2026 à noite, depois da primeira rodada da regra
nova, com os mesmos filtros da página. Servem para conferir a tela depois de
publicar; pendências mudam a cada rodada das 07:00.

**Este mês** (fechamento de 01 a 17/09):

| | |
|---|---|
| Vendas no CRM | 31 (26 conferidas, 5 valor divergente, nenhuma sem assinatura ou aguardando) |
| Receita no CRM | R$ 4.776,70 |
| No banco, das vendas | R$ 4.631,80 |
| Diferença | +R$ 144,90, que é a soma das 5 divergências: Milene Lazaro +10, Sandra Schimidt +100, Kleilson +9,90, Fernanda Mafra −15, Leny Rossetto +40 |
| Assinaturas no banco | 35 iniciadas: 33 com venda, 2 sem venda (Jack, de Julia Ruiz; Zoe, de Rosilangela Marafigo), nenhuma de valor zero; 1 já cancelada |
| MRR no banco | R$ 4.941,60 |
| Duplicados | nenhum |

**Mês passado** (fechamento em agosto, regra antiga; ver "Agosto"):

| | |
|---|---|
| Vendas no CRM | 128 (30 conferidas, 15 valor divergente, 6 sem assinatura, 77 aguardando), 51 delas em pares duplicados |
| Receita no CRM | R$ 20.154,90 (bate com o Painel Comercial) |
| Assinaturas no banco | 121 iniciadas: 35 com venda, 82 sem venda, 2 cortesias, 2 aguardando |

## Detalhes que custaram para descobrir

- **Um operador por campo no filtro.** `{ closeDate: { gte, lt } }` é recusado
  ("must have exactly one operator"); cada operador vai numa entrada do `and`.
- **Data de início é data pura**, sem hora: o filtro recebe `AAAA-MM-DD`. Data
  de fechamento tem hora e vem em UTC, mas muitas vezes é "só data" à
  meia-noite UTC; ver `diaCivil`.
- **Paginação por `offset` conferida contra `totalCount`**, herdada do painéis,
  com aviso na tela quando o período tem registros demais.
- **Relações vêm na mesma consulta** (`pointOfContact { name }`,
  `tutor { name }`): dispensa uma segunda busca por pessoa.
- **`navigate` do SDK** é o jeito de o componente abrir um registro; um link
  comum não sai do quadro.
- **Variável de app chega cifrada ao componente de tela** (`enc:v2:…`), mesmo
  não sendo segredo. Ver "Acesso".

## O que ainda não está aqui

- Limpar os negócios duplicados de agosto (25 pares) e descobrir o que os
  criou em lote em 28/08.
- Exportar o mês (CSV).
- Rodar o sync da Petbee sob demanda; hoje ele é um cron no servidor.
- Estreitar o papel do app aos objetos que ele lê.

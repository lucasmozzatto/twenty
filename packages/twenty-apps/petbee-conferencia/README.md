# Conferência Petbee

Conferência entre o funil de vendas do CRM e o banco da Petbee, declarada em
código, com seletor de período e passo de mês em mês.

## O objetivo

Fechar o mês com os dois lados iguais, para calcular o bônus de cada vendedor:
cada venda ganha no CRM precisa ter a assinatura correspondente no banco, com o
mesmo valor, e cada assinatura nova no banco precisa ter a venda ganha no CRM.
Quando a diferença é zero e nada está pendente, o mês está fechado.

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
| Resumo | vendas e receita no CRM; assinaturas e MRR no banco; a diferença; e os vereditos: conferidas, valor divergente, sem assinatura, sem venda no funil, aguardando |
| Por vendedor | vendas, receita CRM, valor no banco e vendas por veredito, por dono atual do negócio, com total |
| Vendas × banco | uma linha por negócio ganho, com valor CRM, valor no banco, diferença e veredito; abre em "Com pendência" |
| Assinaturas do banco | uma linha por assinatura iniciada no período, com tutor, MRR, status e veredito; abre em "Sem venda" |

Clicar no cliente abre o negócio; no pet, a assinatura; no tutor, a pessoa.
As listas crescem de 40 em 40, porque o quadro tem altura fixa na grade.

## As duas regras de filtro

Estão em `src/painel/dados.ts` e valem para tudo:

- **Venda** → Etapa = Ganho + **data de fechamento** dentro do período, em
  qualquer funil.
- **Assinatura** → **data de início** dentro do período, em qualquer status.

Fechamento, e não criação, de propósito: a venda acontece quando fecha. Um
negócio criado em agosto e ganho em setembro é venda de setembro, e é assim
que o bônus conta. Qualquer funil e qualquer status porque a pergunta é "o que
existe de cada lado"; as fichas da tela recortam depois. Cortesia (marcada
como tal, ou com valor zero) aparece na lista mas fica fora da conta de
dinheiro, igual à conciliação.

## De onde vêm os vereditos

Dos campos que a conciliação diária grava: **Conferência banco** no negócio
(Conferida / Valor divergente / Sem assinatura, com o **Valor no banco**) e
**Conferência funil** na assinatura (Com venda / Sem venda / Cortesia). A regra
dela, lida do nó "Cruzar e decidir" em 17/09/2026:

- casa por pessoa (ponto de contato do negócio = tutor da assinatura), com
  início da assinatura a até 7 dias da **data de criação** do negócio;
- venda sem assinatura casada é "Sem assinatura"; soma das assinaturas igual
  ao Amount (tolerância de um centavo) é "Conferida"; senão "Valor divergente";
- assinatura cortesia ou de valor zero é "Cortesia"; com venda ganha do mesmo
  tutor na janela é "Com venda"; senão "Sem venda";
- busca vendas ganhas **criadas** nos últimos 30 dias e assinaturas iniciadas
  nos últimos 30 dias, e só julga o que tem até 23 dias.

"Aguardando conciliação" não é valor do campo: é o vazio, quando a conciliação
ainda não passou por aquele registro.

### A ressalva que ainda está aberta: o cruzamento usa a data de criação

A página corta pela data de fechamento; a conciliação casa pela data de
criação. Enquanto for assim, dois efeitos aparecem na tela e **não são erro da
página**:

- **Falso alarme** quando a venda fecha muito depois de criada, ou quando o
  negócio foi cadastrado depois com fechamento no passado. Casos de 17/09:
  Thiciane Ferraz (fechou 19/08, criada 08/09, duas assinaturas de 19/08 que
  somam exatamente a venda), Luigi Kreiss Sperotto, Rita Rojas, Katia Gomes e
  Audrey Ignatowicz. Só Jack (Julia Ruiz Retamal) era pendência de verdade: o
  negócio foi Ganho, chegou a ser "Conferida", e voltou para "Em negociação".
- **"Aguardando" para sempre** em venda ganha de negócio criado há mais de 30
  dias: a conciliação nem chega a buscá-la. É o caso de 77 das 128 vendas de
  agosto (medido em 17/09).

O ajuste é no workflow do n8n, não aqui: trocar `createdAt` por `closeDate` na
busca das vendas e na janela de 7 dias do cruzamento, e rodar uma vez sobre os
meses anteriores. Depois disso, "Mês passado" fecha de verdade.

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

Da máquina local, com Node 22+ e o remote `petbee` configurado:

```bash
cd packages/twenty-apps/petbee-conferencia
yarn install && yarn typecheck
yarn twenty plan
yarn twenty apply
```

## Conferência dos números

Medidos pela API em 17/09/2026, com os mesmos filtros da página. Servem para
conferir a tela depois de publicar; pendências mudam a cada rodada das 07:00.

**Este mês** (fechamento de 01 a 17/09):

| | |
|---|---|
| Vendas no CRM | 28 (21 conferidas, 4 valor divergente, 1 sem assinatura, 2 aguardando) |
| Receita no CRM | R$ 4.202,10 |
| Assinaturas no banco | 31 iniciadas: 22 com venda, 4 sem venda, 5 cortesias |
| MRR no banco | R$ 3.727,40 cobrados (mais R$ 679,60 de cortesias, fora da conta) |

**Mês passado** (fechamento em agosto):

| | |
|---|---|
| Vendas no CRM | 128 (30 conferidas, 15 valor divergente, 6 sem assinatura, **77 aguardando**) |
| Receita no CRM | R$ 20.154,90 (bate com o Painel Comercial) |
| Assinaturas no banco | 121 iniciadas: 35 com venda, 82 sem venda, 2 cortesias, 2 aguardando |
| MRR no banco | R$ 15.527,00 |

Os 77 "aguardando" e os 82 "sem venda" de agosto são a ressalva acima, não a
página: a conciliação só olha 30 dias para trás pela data de criação.

## Detalhes que custaram para descobrir

- **Um operador por campo no filtro.** `{ closeDate: { gte, lt } }` é recusado
  ("must have exactly one operator"); cada operador vai numa entrada do `and`.
- **Data de início é data pura**, sem hora: o filtro recebe `AAAA-MM-DD`. Data
  de fechamento tem hora e vem em UTC: o dia mostrado é o de Brasília.
- **Paginação por `offset` conferida contra `totalCount`**, herdada do painéis,
  com aviso na tela quando o período tem registros demais.
- **Relações vêm na mesma consulta** (`pointOfContact { name }`,
  `tutor { name }`): dispensa uma segunda busca por pessoa.
- **`navigate` do SDK** é o jeito de o componente abrir um registro; um link
  comum não sai do quadro.
- **Variável de app chega cifrada ao componente de tela** (`enc:v2:…`), mesmo
  não sendo segredo. Ver "Acesso".

## O que ainda não está aqui

- O cruzamento por data de fechamento na conciliação (n8n), com a rodada sobre
  os meses anteriores. Sem isso, "Mês passado" mostra pendências que não são.
- Exportar o mês (CSV) para a planilha do bônus.
- Estreitar o papel do app aos objetos que ele lê.

# Painéis Petbee

Painéis comerciais do CRM declarados em código, em vez de montados clicando na tela.

> **Este README é a fonte das regras.** O `CLAUDE.md` desta pasta é o resumo de uma
> página, com as regras que não se quebram e como publicar; o detalhe, o porquê de cada
> decisão e as conferências de número estão aqui.

## Por que um app separado do `petbee-cadencia`

O `petbee-cadencia` tem quatro logic functions que **escrevem** no CRM e governam a
régua de follow-up. Cada `yarn twenty dev` naquele app toca uma automação em produção.

Painel é leitura. Misturar os dois significaria que publicar um gráfico novo passa
pelo mesmo deploy que a cadência — e um erro de painel poderia derrubar a régua.

Separado, o pior caso de um deploy daqui é um gráfico errado. Nada mais.

O papel deste app (`src/default-role.ts`) é **somente leitura**, de propósito: ele não
tem permissão de escrita nenhuma, então não consegue alterar um negócio nem por bug.

## O que ele cria

Uma página chamada **Painel Comercial** no menu lateral, com uma aba só,
**Por período**: um quadro com seletor de datas (este mês, mês passado, 7 dias,
30 dias, 8 semanas, desde 01/09, ou De/Até livre) e botão de comparar com o período
anterior.

Abaixo do seletor, quatro visões, como abas **dentro do quadro**:

| Visão | Conteúdo |
|---|---|
| **Visão geral** | seis números, duas linhas do tempo por dia, barras por origem e canal |
| **Funil** | funil por etapa lido do histórico: fluxo do período, a tabela "de cada etapa, para onde foi" (com as lentes próximo passo e situação hoje) e o cohort dos que negociaram |
| **Ads** | leads criados no período e quantos viraram venda, por origem, canal e cada pedaço da UTM, com seletor de dimensão |
| **Vendedores** | a tabela por vendedor (recebidos, ganhos, perdidos, em aberto, taxa), pipeline em aberto, sem dono, em negociação, perdas com conversa, pipeline por dono, vendas por vendedor, pipeline por etapa e dono, motivos de perda |
| **Cohort** | conversão por lote de leads entregues aos vendedores, por semana (quarta a terça) ou mês, e a grade vendedor × cohort. Aqui o período é a data em que o lead **chegou no vendedor** |

Diferente do gráfico nativo, o vazio aparece como barra própria ("Sem origem",
"Sem canal", "Sem dono").

### Por que abas dentro do quadro, e não abas do CRM

Cada aba do CRM é um quadro independente, com o próprio seletor de período — a pessoa
escolheria o período três vezes, uma por aba, e era exatamente isso que o quadro
existe para evitar. Com as abas dentro do quadro, o período se escolhe uma vez e vale
para as três visões. Os dados das três vêm juntos numa carga só, então trocar de visão
é instantâneo.

A aba do CRM está em modo **grade**, com o quadro em 30 linhas de 55px (~1.650px), o
que cabe a visão mais alta; as outras sobram em branco embaixo. O modo **lista vertical**
foi tentado em 16/09/2026 e não serve: o quadro saiu com largura de coluna lateral e
altura fixa com rolagem interna. Aquele modo é feito para a página do registro (é como
a aba "Régua" da cadência roda), não para uma página inteira. Se uma visão crescer e
aparecer barra de rolagem dentro do quadro, é o número de linhas em
`src/page-layouts/comercial.page-layout.ts` que sobe.

### As abas "Comercial" e "Vendedores" foram apagadas

Existiram até 16/09/2026, feitas de 23 gráficos nativos. Mostravam o mesmo que a aba
"Por período" travado em "este mês", e toda melhoria passou a entrar só nela — duas
telas contando a mesma coisa acabam divergindo, e a que ninguém mantém vira a errada.

Estão no git, com os mesmos identificadores, se um dia precisarem voltar.

### Por que a aba "Por período" é um componente e não gráfico nativo

Gráfico nativo só lê o filtro gravado nele mesmo: não existe filtro de data da página
inteira, nem por variável, nem por aba. O único caminho é um **front component**
(`src/components/painel-periodo.front-component.tsx`) que pergunta ao GraphQL do CRM
com o período que a pessoa escolheu. Ele roda no navegador, dentro de um worker, com
o token do app (somente leitura) injetado pelo runtime, do mesmo jeito que a régua da
cadência faz.

### Os dois tempos dentro da aba

Está escrito na tela de propósito, porque é o erro mais fácil de cometer lendo:

- **Segue o período**: negócios criados, vendas, receita, ticket, conversão, sem origem,
  as linhas por dia, as barras de origem e canal, vendas por vendedor, perdas com
  conversa e motivos de perda.
- **Foto de agora, ignora o período**: negócios em aberto, sem dono, em negociação,
  pipeline por dono e pipeline por etapa e dono. "Quantos estavam em aberto em agosto"
  não se responde olhando o estado atual do CRM — o campo guarda só a etapa de hoje.

O dono contado é sempre o dono **atual** do negócio.

### O funil por etapa, e as duas medidas que não se misturam

O campo Etapa guarda só o estado de hoje: um negócio que passou por "Em negociação" e
virou Ganho aparece apenas como Ganho. Quem guarda o caminho é a linha do tempo, uma
linha por mudança, com a etapa de antes e a de depois em JSON. Gráfico nativo não abre
JSON; `src/painel/funil.ts` lê e conta.

São **duas medidas diferentes**, separadas na tela de propósito:

- **Fluxo** ("O que aconteceu no período"): negócios que passaram por cada degrau
  DENTRO do período. A razão entre um degrau e outro **não é conversão** — um negócio
  ganho em setembro pode ter entrado em negociação em agosto.
- **Cohort** ("Dos que entraram em negociação no período, como estão hoje"): esse sim é
  conversão. Mesmo grupo de negócios, olhado agora: ganhos, perdidos, ainda em aberto.

Quatro cuidados:

- **Conta negócio distinto, não evento.** Um negócio que volta para negociação depois
  de um Break geraria duas linhas no histórico; contar as duas inflaria o funil.
- **"De Ganho para Ganho" não é entrada.** Existe linha no histórico em que a etapa de
  antes e de depois são iguais: alguém editou outro campo e o CRM gravou a etapa junto.
  Em setembro/2026 foi 1 em 36 linhas de "ganho", e contava como venda nova até
  17/09. Toda contagem de entrada passa por `entrouEm`, que exige mudança de verdade.
- **O histórico começa em 18/08/2026.** Antes disso o CRM não gravava. Período que
  comece antes mostra um aviso laranja, porque os números sairiam por baixo.
- **Paginação por `offset`, não por cursor, e conferida contra `totalCount`.** A
  primeira versão usava `after`/`endCursor` e parou na primeira página em produção: em
  409 mudanças de 7 dias ela leu 100 e mostrou 21 entradas em negociação em vez de 76,
  **sem avisar**, porque o "li tudo" era um `false` fixo. Agora cada página vem por
  `offset` com ordem fixa, e o aviso de leitura incompleta sai de comparar o que foi
  lido com o total que o servidor informa. Teto de 40 páginas de 200.
- **"Quem clicou" não dá; "para quem foi" dá.** Das 901 mudanças de setembro, 689 não
  têm pessoa: foram feitas pela automação do n8n via API. Então não existe "quem moveu
  a etapa". Mas o processo da Petbee é a automação delegar o lead ao vendedor **no mesmo
  instante** em que o passa para negociação (o histórico mostra `owner` e `stage`
  mudando na mesma linha), e o dono fica com o negócio até o fim. Por isso a tabela por
  vendedor usa o **dono atual** do negócio, e isso responde "quantos a Vitoria vendeu
  depois da qualificação". A ressalva vai na tela: negócio repassado conta para quem
  está com ele hoje, e quem está em aberto ainda não é veredito.

### De cada etapa, para onde foi (a jornada)

Uma linha por etapa de partida (Novo Lead, Em qualificação, Em negociação, Fechamento,
Break), uma coluna por destino, e cada linha soma 100%: são os negócios que **entraram
naquela etapa dentro do período**. Responde "quantos novos leads vão para qualificação
ou direto para ganho", "quantos de negociação vão para Break e depois viram o quê", e
por aí. Pedido do dono do painel em 17/09/2026; `src/painel/jornada.ts` conta,
`tabela-jornada.tsx` desenha.

Como a conta é feita: o CRM grava uma linha na linha do tempo a cada mudança de etapa,
com hora, etapa de antes e de depois. Para cada negócio as linhas são ordenadas por
hora e lidas como uma história. Duas lentes sobre o mesmo lote, num botão:

- **Próximo passo**: para cada entrada na etapa, a linha seguinte da história. Conta
  entradas, então quem voltou para negociação depois de um Break conta duas vezes na
  linha "Em negociação" (foram dois passos de verdade). Sem linha seguinte, "Ainda aqui".
- **Situação hoje**: dos negócios que entraram na etapa, onde cada um está agora. Conta
  negócios distintos. É a lente que responde "foi para Break e depois virou Ganho ou
  Perdido?".

Regras que valem para as duas: "entrar em Novo Lead" é ser criado; a etapa inicial é o
"antes" do primeiro passo (ou a etapa de hoje, se nunca mudou), e quem nasceu já em
outra etapa aparece numa nota abaixo da tabela e conta na linha da etapa em que nasceu.
Só mudança de verdade conta como entrada (ver "Ganho para Ganho" abaixo). Os passos
dados depois do fim do período entram na conta do próximo passo, senão toda entrada de
fim de mês pareceria "ainda aqui".

As linhas **não fecham em cadeia**: um negócio criado em 30/08 que entrou em qualificação
em 02/09 está na linha "Em qualificação" de setembro e não na "Novo Lead". Com o piso
de 01/09 (abaixo) a diferença é só a virada do mês.

O cabeçalho muda com a lente, de propósito. Em "Próximo passo" as colunas têm seta
("→ Perdido": foi para lá). Em "Situação hoje" não têm ("Perdido", "em negociação",
"no Break": está lá). A seta na segunda lente fez o dono do painel ler "→ Perdido 145"
como "145 perdidos nesta etapa", quando é "145 que passaram por esta etapa e hoje
estão perdidos, onde for". Abaixo da tabela há uma linha que diz como ler a lente
ativa. A regra que resolve a confusão: **Próximo passo mostra a primeira porta que o
lead pegou; Situação hoje mostra a sala onde ele está agora. As duas não se subtraem.**

### Os blocos "Como ler"

Cada visão tem, logo abaixo do título, um bloco fechado "Primeira vez aqui? Como ler
esta visão", e o topo do quadro tem "Como ler este painel". São listas curtas, em
português simples, escritas para quem nunca viu o painel: o que o período significa
ali, o que cada número é, e as pegadinhas (o que não é conversão, o que não se subtrai,
o que é foto de agora). Ficam fechados para não ocupar a tela de quem já sabe. Os
textos estão em `src/painel/guias.ts`, um por visão, para serem corrigidos como texto,
sem mexer nas telas. Pedido do dono do painel em 17/09/2026, depois de explicar a
jornada ao time.

### O piso do histórico: 01/09/2026

O CRM grava a linha do tempo desde 18/08/2026, mas até o fim de agosto o processo ainda
estava sendo ajustado depois da migração. Por decisão do dono do painel em 17/09/2026,
**tudo que lê o histórico** (Funil, Cohort e a jornada) conta a partir de 01/09/2026:
`recortarNoHistorico` em `periodo.ts` recorta o início do período e a visão avisa em
laranja quando a data escolhida era anterior. A Visão geral não lê o histórico e não é
recortada. Na tabela por vendedor, Recebidos e Em aberto vêm do histórico e obedecem ao
piso; Ganhos e Perdidos vêm da data de fechamento do negócio e seguem o período inteiro.
O botão "Desde 01/09" é o mesmo piso.

### A tabela por vendedor

É a pergunta principal do painel, e as colunas seguem regras diferentes de propósito,
combinadas com o dono do painel em 16/09/2026:

| Coluna | Regra | De onde vem |
|---|---|---|
| Recebidos | chegaram no vendedor **no período**: a primeira entrada em negociação de cada negócio, uma vez só; quem voltou do Break não conta de novo. Mais as vendas contadas cujo lead nunca passou por negociação, no dia da venda. A mesma conta da visão Cohort | cohort (`cohort.ts` + `incluirVendasSemNegociacao`, somado por dono em `recebidosPorVendedor`, `cohorts.ts`) |
| Em aberto | recebidos que hoje ainda não são Ganho nem Perdido | cohort (idem) |
| Ganhos | viraram Ganho no período (data de fechamento) e o campo **Fechamento** diz Comercial; Direto e Recompra ficam fora; sem o campo, só se passou por negociação ou se um vendedor marcou à mão | desfechos (`desfechos.ts`) |
| Perdidos | estão em **Perdido hoje**, com a **data de fechamento** dentro do período, e passaram por negociação em alguma data | desfechos (`desfechos.ts`) |
| Taxa | ganhos ÷ recebidos: vendas do período sobre leads que chegaram no período | conta na tela |
| Receita | soma do valor dos ganhos | desfechos |
| Ticket médio | receita ÷ quantidade de ganhos, igual na linha da pessoa e no Total; venda sem valor preenchido puxa o ticket para baixo | desfechos |

Todo membro do workspace tem linha, mesmo zerado: num dia parado, uma pessoa que some da
tabela parece erro, e a lista completa é o que permite comparar. "Sem dono" só aparece
quando tem algo. Pedido do dono do painel em 17/09/2026.

A exceção é quem não vende: `src/painel/equipe.ts` lista esses membros, e eles só
aparecem se algum número cair no nome deles no período — aí a linha é o aviso de que um
lead ou uma venda foi parar em quem não é do comercial. A lista mora no código porque o
CRM não tem onde guardar isso: "Membros do workspace" é objeto de **sistema** e não
aceita campo novo, e as Funções do CRM são de permissão, servidas num endereço que exige
a permissão `ROLES` — que o papel somente-leitura do painel não tem, e que não vale a
pena conceder só para isso. Quando o time mudar, edite o arquivo e publique.

Recebidos e Em aberto usam a mesma base da visão Cohort desde 17/09/2026, por decisão do
dono do painel, para as duas telas baterem. Antes, a tabela lia o Funil, que contava
qualquer entrada em negociação no período: um lead que chegou em agosto, foi para o Break
e voltou em setembro aparecia como "recebido" em setembro de novo. Agora cada negócio
conta uma vez, no período em que chegou pela primeira vez, e o efeito é uma queda pequena
em Recebidos (uns 3 ou 4 por mês para a vendedora, em setembro/2026). Como a base é o
histórico, obedece ao piso de 01/09 e a visão avisa em laranja quando recorta.

O ponto que muda tudo: **Ganhos e Perdidos não se limitam aos recebidos do período**.
Um lead delegado em agosto e vendido em setembro conta em setembro. É por isso que
Recebidos − Ganhos − Perdidos **não** dá Em aberto, e a tela diz isso na nota do quadro.

**Ganhos seguem o campo "Fechamento" do negócio**, decisão do dono do painel em
17/09/2026, porque esta tabela serve para comissão e a regra tem que ser do negócio, não
uma dedução do painel. O campo é preenchido pela automação da venda (o painel do
vendedor) e conferido pelo gerente comercial nos ganhos do mês. Comercial conta para o
dono do card; Direto (fechou sem passar pelo comercial) e Recompra (não dá comissão)
ficam fora. Venda com o campo vazio entra só com evidência forte de que um vendedor
trabalhou nela: passou por "Em negociação" ou "Fechamento" em alguma data, ou um
vendedor marcou o Ganho à mão (o histórico registra quem clicou e se foi manual). Todas
as vazias aparecem numa lista laranja abaixo da tabela, com link para o negócio, para o
gerente preencher o campo no CRM. A ideia é que, com o tempo, a comissão vire 100% o
campo.

A motivação foi setembro/2026: das 13 vendas da vendedora, 7 tinham passado por
negociação e 6 não, e duas dessas seis foram vendas de verdade que ela marcou à mão
porque o WhatsApp estava fora e o card não foi movido. Só "passou por negociação" dava 7;
a regra do campo dá 11 (10 Comercial + 1 vazia marcada à mão), e deixa 2 vazias de
compra automática pelo site fora, apontadas na lista.

**Perdidos saem da data de fechamento do negócio**, a mesma régua das vendas. Entra quem
está em Perdido **hoje**, com data de fechamento dentro do período, e que passou por
negociação em alguma data.

A coluna mudou três vezes em 21/09/2026, e vale registrar o caminho para ninguém refazê-lo:
lia o evento "virou Perdido" no histórico (o que a prendia ao piso de 01/09), passou para a
data de fechamento, foi para a data de **criação** por algumas horas e voltou para a data de
fechamento no mesmo dia. O motivo da volta, dado pelo dono do painel: como quase todo lead
decide em menos de 48 horas, as duas contas dão quase o mesmo número, e "perdeu neste mês"
é mais simples de explicar ao time do que "entrou neste mês e morreu". A régua por criação
também fazia o número do mês crescer depois do mês fechado, como os lotes do Cohort, o que
confundia a leitura mês a mês.

Para referência, a diferença medida em 21/09/2026 para setembro: 566 perdas pela data de
fechamento contra 274 pela data de criação. A maior parte dessas 292 era limpeza de leads
de agosto feita pela cadência em setembro.

A data de fechamento é confiável no fluxo de hoje: quando o card vira Perdido, o fluxo
grava a data no mesmo instante em que muda a etapa, e nenhum negócio em Perdido do funil
Vendas está com o campo vazio. O README anterior dizia que o negócio não guardava data de
perda, o que estava errado.

A condição "passou por negociação" continua vindo do histórico de etapas, que começa em
18/08/2026. Para períodos anteriores a isso a coluna sai baixa, porque não há como saber
quem foi trabalhado por um vendedor.

A diferença que essa condição faz é grande, medida em 21/09/2026 para setembro: 566
negócios viraram Perdido no mês, sendo 296 no dono padrão, 200 na vendedora, 55 sem dono
e 15 no outro vendedor; a tabela mostra 188, porque só conta quem chegou a negociar. O
resto é lead descartado ainda na qualificação, que nenhum vendedor viu.

**A Taxa é ganhos ÷ recebidos**, a "taxa do mês", decisão do dono do painel em
17/09/2026 (até então era ganhos ÷ ganhos + perdidos, que ninguém lia de primeira). Em
cima, as vendas do período pela data da venda, mesmo de lead que chegou no mês anterior;
embaixo, só os leads que chegaram no período. É a conta que o time comercial usa para
falar do mês. O que ela não faz, e a tela avisa no "Como ler": se chegam menos leads, a
taxa sobe sozinha, porque as vendas de sobras do mês anterior entram em cima. Pode passar
de 100% num mês fraco. Quem responde "quanto cada lote de leads rende" é a Cohort.

**Vendas que pularam a etapa de negociação** (checkout com dono, Ganho marcado à mão,
"Em qualificação" direto para Ganho) entram em Ganhos pela regra do campo e, desde
17/09/2026, também em Recebidos, no dia da venda: o vendedor recebeu o lead, só que o
registro da chegada é a própria venda. Sem isso a Taxa saía com a venda em cima e o lead
fora de baixo (setembro/2026: 7 das 15 vendas da vendedora). `desfechos.ts` devolve essas
vendas em `vendasSemNegociacao` e o componente as junta ao cohort com
`incluirVendasSemNegociacao`, de modo que Vendedores e Cohort leem o mesmo lote. A nota
cinza embaixo da tabela (`nota-vendas.tsx`) lista quantas e quais, com link: é o
termômetro do processo, e a garantia de verdade fica na origem (o fluxo de venda mover o
card para "Em negociação" quando o vendedor assume ou manda o link), combinada para depois
de 22/09/2026.

Um negócio perdido que depois foi reaberto (voltou para negociação, foi para Break ou
virou Ganho) **não** conta como perdido: a coluna filtra pela etapa de hoje, então ele
sai da conta sozinho. Foi decisão do dono do painel em 17/09/2026; até então contava pelo evento.

### A visão Ads

Pedido do dono do painel em 22/09/2026, para ter leitura rápida de mídia sem sair do CRM.
Em `ads.ts` (busca e contas) e `secao-ads.tsx` (tela). Uma tabela só, com um seletor de
dimensão em cima: Origem, Canal, Source, Medium, Campanha, Conteúdo, Termo e Teste LP. Os
dois primeiros são campos do CRM; o resto é a UTM que chegou com o lead.

- **A régua é a do LEAD**: entram os negócios **criados** no período, e a venda contada é a
  desses mesmos leads, pela etapa de hoje. É o certo para julgar campanha, porque a
  campanha responde pelo lead que trouxe, não por uma venda de um lead de meses atrás. O
  efeito colateral é o do Cohort: o mês corrente sempre parece pior.
- **Qualificados**, coluna ao lado de Leads, pedida pelo dono do painel em 23/09/2026:
  dos leads criados no período, os que passaram da qualificação e entraram em negociação
  ou fechamento em alguma data. É a diferença entre campanha que traz volume e campanha
  que traz conversa. Vem do histórico de etapas (`negociosQuePassaramPor`), que só existe
  a partir de 18/08/2026; em períodos anteriores a coluna sai baixa.
- **Todas as vendas entram**, inclusive Direto e Recompra, sem a regra de comissão: quem
  trouxe o lead trouxe, não importa quem fechou. Esta visão não serve para comissão.
- **O texto da UTM é lido em minúsculas e sem espaço nas pontas.** O CRM guarda "google" e
  "Google" como coisas diferentes; a limpeza é só na leitura, o painel nunca escreve.
- **"Sem valor"** fica em itálico no fim da tabela. Não é erro: é o lead que chegou sem
  aquela informação.
- A tabela mostra 25 linhas e resume o resto numa linha de rodapé, porque campanha e
  conteúdo têm cauda longa.

Medições de 22/09/2026, com "Este mês", que justificam os avisos da tela: dos 536 leads
criados, 238 vieram de `meta`, 202 **sem UTM**, 77 de `google` e o resto pulverizado; das
41 vendas, **22 não têm UTM**, 9 vieram de `google`, 6 de `meta`, 3 de `app` e 1 de
`Google` com maiúscula, que a limpeza junta com `google`. Em campanha aparecem `quiz` com
135, 215 sem campanha e sujeira real como `{{campaign.name}}`, um template que não foi
substituído, e ids numéricos.

**O que esta visão não faz:** custo. O gasto está no Meta e no Google, não no CRM, então
não há custo por lead nem por venda. Trazer gasto para dentro é outro projeto, e o app
tem acesso só ao CRM.

### Semana a semana: o acompanhamento fixo

Um quadro na visão Vendedores, logo abaixo da tabela principal, em `semanas.ts` (busca e
contas) e `tabela-semanas.tsx` (tela). Pedido do dono do painel em 22/09/2026 para
enxergar a evolução sem ficar trocando o filtro de período.

- **Não obedece ao filtro de período.** Mostra sempre as últimas 24 semanas comerciais, de
  quarta a terça, a mais recente no topo. É buscado uma vez, quando o painel abre, e não a
  cada troca de período.
- **Começa no piso de 01/09/2026 e cresce sozinho**: toda quarta nasce uma linha; ao passar
  de 24 semanas, a mais antiga sai. O dono do painel pediu o piso para a tabela não
  misturar o dado migrado do CRM antigo com o processo de hoje. A primeira linha, a semana
  de 26/08 a 01/09, aparece marcada como **parcial**, porque só o dia 01/09 conta; a última
  aparece como **em andamento**.
- **Colunas**: Recebidos, Ganhos, Taxa, Receita e Ticket médio, com botões para trocar
  entre o time e cada pessoa. As regras são as mesmas da tabela principal: Recebidos é a
  primeira entrada em negociação dentro da janela, Ganhos é a venda com Fechamento =
  Comercial pela data de fechamento (ou campo vazio com passagem por negociação ou marcada
  à mão), e o ticket é receita ÷ ganhos.
- **Sem a coluna Perdidos**, de propósito. Contar perdas do jeito certo exige checar, card
  a card, quem passou por negociação; em 24 semanas cheias isso viraria dezenas de
  consultas extras e a tela ficaria lenta. Como a Taxa é ganhos ÷ recebidos, nada essencial
  se perde. Medido em 22/09/2026: as últimas 24 semanas do CRM tinham 2.842 negócios
  perdidos contra 511 vendas, e é essa diferença de volume que inviabiliza a coluna.
- **Venda que pulou a etapa também conta como recebido**, no dia da venda, exatamente como
  na tabela principal. A primeira versão do quadro esquecia disso e a Taxa saía inflada: a
  venda entrava em cima da fração e o lead não entrava embaixo. A checagem de "passou por
  negociação em alguma data" olha o histórico inteiro, e não só a janela, para não contar
  de novo um lead que já foi recebido antes do piso.
- Recebidos usa a **primeira entrada dentro da janela**. Um negócio que entrou em
  negociação antes do piso e voltou depois conta na semana em que voltou, diferente da
  visão Cohort, que o trataria como veterano. A diferença só existe nas primeiras semanas
  e desaparece conforme a janela anda.

### Auditoria de 22/09/2026, antes de a tabela virar base de comissão

O dono do painel pediu uma revisão adversarial da visão Vendedores antes de pagar
comissão por ela. O que foi corrigido, tudo na mesma leva:

| Achado | Onde | Efeito |
|---|---|---|
| "Marcou o Ganho à mão" não checava se a etapa mudou | `desfechos.ts`, `semanas.ts` | linha "de Ganho para Ganho" feita por uma pessoa transformava venda direta em venda comissionada; agora exige `entrouEm` |
| Rótulo desconhecido no campo Fechamento sumia em silêncio | `desfechos.ts` | valor fora de Comercial/Direto/Recompra agora cai na lista de conferência, em vez de zerar a comissão sem aviso |
| O quadro semanal decidia "passou por negociação" só dentro da janela | `semanas.ts` | venda de campo vazio de um lead que negociou antes do piso contava na tabela principal e não no quadro semanal |
| O quadro semanal não excluía veteranos | `semanas.ts` | lead que voltou de fora da janela era contado como recebido de novo |
| `negociosQuePassaramPor` e `etapaAntesDePerder` jogavam fora a flag de truncamento | `linha-do-tempo.ts` | leitura pela metade passava como completa, sem a tarja laranja |
| `agrupar` por lista de ids não era lotado | `desfechos.ts`, `crm.ts` | com a lista crescendo, o servidor recusaria a consulta e Ganhos, Receita e Ticket iriam a zero para todos |
| Paginação por `offset` sem desempate | `crm.ts`, `linha-do-tempo.ts` | empate de horário na fronteira de página podia repetir ou perder registro; agora a ordem tem `id` como segundo critério |
| Ticket médio por pessoa usava a média do CRM | `desfechos.ts` | a média do servidor ignora venda sem valor e a linha discordava do Total; agora as duas são receita ÷ vendas |
| Falha ao carregar nomes ou o quadro semanal sumia | `painel-periodo.front-component.tsx` | agora entram na tarja de falhas, em vez de a tela mentir que está completa |
| Período inteiro anterior ao piso | `secao-vendedores.tsx` | o aviso dizia "foi recortado" quando o resultado é nada; agora diz que o período termina antes de o histórico existir |
| Venda injetada no cohort entrava no "até vender" com 0 dia | `cohort.ts`, `cohorts.ts` | puxava a média para baixo sem significar nada |

Fica registrada uma limitação do dado, que **não** tem correção no painel: `feitaPorPessoa`
só enxerga o autor quando ele muda em relação à linha anterior do histórico. Se a mesma
pessoa fez a edição anterior, o CRM não regrava o autor no diff e a marcação manual não é
vista. Na prática isso quase não pesa, porque a inbox escreve por chave de API e nunca
aparece como marcação manual; a defesa real é o campo Fechamento estar preenchido.

### De onde saem as perdas, e por quê

Duas tabelas no fim da visão Vendedores, pedidas pelo dono do painel em 21/09/2026, em
`perdas.ts` (busca e contas) e `tabela-perdas.tsx` (tela). Antes só existia um gráfico de
barras com os motivos, que não dizia em que etapa o lead estava, e ainda por cima usava
outra régua ("perdidos criados no período"). Esse gráfico saiu.

- **A perda entra pela mesma régua da coluna Perdidos**: está em Perdido hoje e a data de
  fechamento cai no período. As duas tabelas e a coluna contam a mesma coisa, com uma
  diferença de propósito: aqui entram TAMBÉM as perdas que nunca passaram por negociação,
  porque a pergunta é sobre o funil inteiro. A etapa de saída é buscada **por id**, e não
  por data (`etapaAntesDePerder`, em `linha-do-tempo.ts`): assim ela funciona com qualquer
  régua de período e nada cai em "Sem registro" só porque o evento ficou fora da janela.
- **A etapa de saída** vem do histórico: a etapa que estava no `before` da última vez que
  o negócio entrou em Perdido. Perda sem esse registro (lead criado já perdido, ou perda
  anterior ao início do histórico) cai em **Sem registro**, coluna em cinza. Em
  setembro/2026 são cerca de 130 de 566, herança da migração do CRM; o dono do painel
  pediu para mostrar em vez de esconder, para dar para acompanhar se o número cai.
- **Novo Lead e Em qualificação** aparecem em itálico: é descarte da IA antes de o lead
  chegar num vendedor. A nota do quadro diz quantas perdas do período aconteceram com o
  lead já na mão de alguém.
- A segunda tabela usa **as mesmas colunas** da primeira, trocando vendedor por motivo, e
  os botões no topo filtram por pessoa. É o cruzamento que interessa: "falta de retorno"
  em qualificação é lead que nunca respondeu a IA, em negociação é lead que conversou com
  a vendedora e sumiu. Em setembro/2026 esse motivo sozinho tinha 311 das perdas.

- **Clicar num número** abre embaixo a lista dos negócios daquela célula
  (`lista-de-perdas.tsx`): o código curto do negócio, que abre o card, o motivo e um link
  para a conversa. Pedido do dono do painel em 21/09/2026, para conferir na conversa se o
  motivo registrado é justo. O link abre a **ferramenta de atendimento da casa**, no mesmo
  formato que o CRM já usa na coluna WhatsApp das tarefas: `https://wpp.petbeetools.com.br/`
  com os dígitos em `?tel=`. O número do cliente nunca aparece escrito, vai dentro do
  endereço. Número com 10 ou 11 dígitos ganha o `55` na frente (a conta é por tamanho, e
  não por "começa com 55", porque 55 também é DDD); fora da faixa de 12 a 15 dígitos, o
  link não aparece. A lista mostra 30 itens e avisa quantos ficaram de fora. Em setembro/2026,
  73 negócios perdidos estavam sem WhatsApp preenchido.

Medições de 21/09/2026, para conferência, com "Este mês": 437 eventos de perda no
histórico, sendo 200 saídos de Em negociação, 164 de Em qualificação, 62 de Novo Lead, 8
de Break e 1 de Fechamento; 566 negócios em Perdido com data de fechamento no mês, sendo
296 no dono padrão, 200 na vendedora, 55 sem dono e 15 no outro vendedor.

### A visão Cohort: a medida justa de conversão por vendedor

A tabela por vendedor responde "como foi o mês". O Cohort responde "quem converte
melhor", e para isso muda a pergunta: **dos leads que chegaram nesta pessoa nesta
semana, quantos viraram venda?** Em cima e embaixo da fração estão os mesmos leads,
e por isso a taxa não mexe quando a cadência encerra leads antigos em lote, coisa que
derruba a taxa do mês sem ninguém ter vendido pior. Foi a escolha do dono do painel em
17/09/2026, depois de comparar os dois jeitos.

Como funciona, em `src/painel/cohort.ts` (busca) e `src/painel/cohorts.ts` (contas):

- **Só o funil Vendas.** O histórico de etapas não guarda o funil, então o filtro entra na
  busca da situação de cada negócio (`SO_FUNIL_DE_VENDAS`, passado a `listarNegociosPorId`
  no Cohort e na jornada). Em 21/09/2026 os 13.913 negócios do CRM estavam todos no funil
  Vendas, então o filtro não muda número nenhum hoje; ele existe para o dia em que o funil
  Corretoras usar as mesmas etapas. Pedido do dono do painel ao revisar as regras.
- **Recebido** = entrou em "Em negociação" ou "Fechamento" pela **primeira vez** dentro
  do período. É o instante em que a IA entrega o lead a uma pessoa (dono e etapa mudam
  na mesma linha do histórico). Cada negócio conta uma vez; quem voltou do Break não é
  lead novo. Quem já tinha entrado antes do período pertence ao cohort de lá, e por isso
  há uma segunda consulta ao histórico só para excluir esses veteranos. Venda contada na
  aba Vendedores cujo lead nunca passou por negociação entra no lote do dia da venda, já
  em Ganho (`incluirVendasSemNegociacao`, decisão de 17/09/2026): o lead foi recebido, só
  que o registro da chegada é a própria venda.
- **Ganho / Perdido / Em aberto** = a situação de **hoje** desses mesmos negócios.
  Conversão = ganhos ÷ recebidos. Receita e ticket médio são dos ganhos. "Até vender"
  é a média de dias entre chegar no vendedor e virar venda.
- **Semana comercial de quarta a terça**, como a Petbee trabalha. O primeiro cohort do
  histórico (19 a 25/08) só tem 3 dias de dados, porque o histórico começa em 23/08; o
  aviso laranja do início do histórico cobre isso.
- **Maturidade.** Quem vai comprar compra em 1 ou 2 dias; quem não vai, a cadência
  encerra em até duas semanas (medido em 17/09: 90% das perdas em 11 dias, máximo 17).
  Então um cohort fechado há 14 dias ou mais aparece como "maduro"; antes disso mostra
  "X% decididos" em laranja, e a semana corrente aparece como "em andamento".
- **"Parcial"** marca o cohort que o período escolhido cortou no meio, deixando dias já
  passados de fora. A semana corrente não é parcial: ela só ainda não acabou.
- **Poucos leads.** Na grade vendedor × cohort, taxa com menos de 30 leads sai em cinza
  e itálico: é sorte, não desempenho. Contagem (recebidos, ganhos, em aberto, receita)
  não recebe a marca, porque contagem não depende de volume para valer.
- **"Mostrar", na grade.** Troca o número da célula sem nova consulta: Conversão
  (padrão), Sobre decididos (ganhos ÷ ganhos + perdidos, para cohort que ainda não
  amadureceu), Recebidos, Ganhos, Em aberto, Receita. A fração embaixo mostra de onde a
  taxa saiu.
- **Detalhe de uma pessoa.** Botões com os nomes abaixo da grade abrem a tabela completa
  daquela pessoa, cohort a cohort, com as mesmas colunas do time mais **"vs. time"**: a
  conversão dela menos a do time no mesmo cohort, em pontos percentuais. É o que separa
  "ela foi bem" de "o mês foi bom para todo mundo". Abre por padrão em quem mais recebeu.
- **Lead que volta.** A prática da Petbee é criar negócio novo quando um lead perdido
  ou ganho reaparece. O negócio velho fica no cohort dele; o novo entra no cohort em que
  chegou. Se em vez disso alguém reabrir o negócio velho, o cohort antigo ganha um Ganho
  tardio, porque a situação é sempre a de hoje. Os dois fecham a conta; o que não
  convém é misturar.
- **Conta tudo**, inclusive os leads que a IA deixou passar e a vendedora perdeu por
  "desqualificado", "região" ou "pet". Decisão do dono do painel: é legado da migração
  e a qualificação já está mais afinada. Cerca de 14% das perdas pós-vendedor eram
  assim em 17/09.
- **Negócio apagado** não aparece: o agrupamento só enxerga o que existe.
- Venda direta, que vai de "Novo Lead" a Ganho sem passar por vendedor, fica fora, como
  na tabela por vendedor.

Por que uma visão separada, e não mais uma tabela em Vendedores: o seletor do topo
passa a significar outra coisa ("chegou no vendedor" em vez de "fechou"), e duas
tabelas com o mesmo seletor e sentidos diferentes numa tela só é pegadinha. A visão diz
o sentido na primeira linha.

### A comparação com o período anterior

Ligada pelo botão, cada número ganha um rodapé com o valor de antes e a variação.
"Anterior" quer dizer coisas diferentes por botão, e a regra está em
`periodoAnterior` (`src/painel/periodo.ts`):

| Escolha | Compara com |
|---|---|
| Este mês | o mesmo trecho do mês passado (01 a 16/08 para 01 a 16/09) |
| Mês passado | o mês anterior a ele, inteiro |
| Últimos 7 / 30 dias | o bloco de mesmo tamanho imediatamente antes |
| Desde 01/09 e De/Até livre | o mesmo número de dias imediatamente antes |

Três decisões que parecem detalhe e não são:

- **Mês compara trecho com trecho.** 16 dias de setembro contra 31 de agosto daria
  uma queda falsa de metade. Fevereiro, sendo mais curto, corta no fim do mês.
- **Taxa varia em pontos percentuais.** Conversão de 7% para 8% subiu 1 ponto; chamar
  isso de "+14%" confunde. Só a Conversão usa `p.p.`, o resto usa porcentagem.
- **Sobe nem sempre é bom.** "Sem origem" e "Perdidos com contato real" ficam vermelhos
  quando crescem (`sentido: 'negativo'`). A variação também leva sinal, para quem não
  distingue verde de vermelho.
- **Antes zero não vira "infinito por cento"**: mostra só "antes 0", sem variação.

**Nas duas linhas do tempo** o período anterior é desenhado por cima, em cinza
tracejado, e o rodapé do cartão traz o total de antes e a variação. Dois cuidados:

- **Uma escala de altura só para as duas linhas.** Com escalas separadas, uma queda
  pela metade desenharia igual à outra e a comparação não diria nada.
- **Elas alinham pelo dia da sequência, não pela data**: dia 1 sobre dia 1. Quando o
  mês anterior é mais curto, a linha cinza acaba antes em vez de ser esticada —
  esticar inventaria dias que não existiram.

**Nas barras** cada linha ganha, à direita do valor, o "antes" e a variação, e um
traço fino cinza dentro da barra marca onde o período anterior estava. Três cuidados:

- **Categoria que sumiu continua na lista**, com barra vazia e −100%. Um canal que
  morreu é justamente o que se quer ver, e ele some se olharmos só o período de agora.
- **A escala inclui o período anterior.** Sem isso a maior barra de agora encheria a
  largura toda e uma queda não apareceria.
- **A ordem é pelo valor de agora**, e entre os zerados pelo que era maior antes.

Pipeline não entra na comparação, pelo mesmo motivo de não seguir o período. Ligada a
comparação, a grade das barras passa a pedir colunas mais largas, senão a barra fica
espremida entre os números.

### Estrutura dos arquivos

O componente (`src/components/painel-periodo.front-component.tsx`) só junta as peças e
busca os dados. O resto está em `src/painel/`:

| Arquivo | O que faz |
|---|---|
| `periodo.ts` | contas de data e a regra do período anterior |
| `crm.ts` | as consultas ao GraphQL |
| `dados.ts`, `comparacao.ts`, `funil.ts`, `desfechos.ts`, `cohort.ts`, `cohorts.ts`, `jornada.ts`, `perdas.ts`, `semanas.ts`, `ads.ts` | as perguntas e as contas derivadas |
| `linha-do-tempo.ts` | leitura paginada do histórico de etapas e o "passou por" |
| `rotulos.ts`, `formato.ts`, `tema.ts`, `grade.ts` | texto, números, cores e layout |
| `cartoes.tsx`, `barras.tsx`, `barras-empilhadas.tsx`, `linha.tsx` | os desenhos |
| `seletor.tsx`, `secao-comercial.tsx`, `secao-funil.tsx`, `secao-vendedores.tsx`, `tabela-vendedores.tsx`, `visoes.tsx`, `secao-ads.tsx`, `nota-vendas.tsx`, `tabela-semanas.tsx`, `tabela-perdas.tsx`, `grade-de-perdas.tsx`, `lista-de-perdas.tsx`, `secao-cohort.tsx`, `tabela-cohorts.tsx`, `grade-cohorts.tsx`, `tabela-jornada.tsx`, `avisos.tsx` | as partes da tela |
| `como-ler.tsx`, `guias.ts` | o bloco "Como ler" e os textos dele, um por visão |

Todos abaixo das 300 linhas que o guia do projeto pede.

**Um quadro que falha não derruba a página.** Cada consulta é embrulhada: quem falhar
aparece zerado e um aviso laranja no topo diz o nome do quadro e o motivo. Sem isso uma
consulta recusada apagava o painel inteiro — e um zero por erro não se distingue de um
zero de verdade.

Cresceu em fatias: v0 dois números → v1 os seis números → v2 barras → v3 a seção
Vendedores → v4 a comparação com o período anterior → v5 o funil por histórico de etapa.

Duas regras do servidor que custaram um deploy cada:

- **O mesmo campo raiz não pode aparecer duas vezes na mesma consulta**, nem com
  apelido ("Duplicate root resolver"). Uma consulta por filtro, disparadas em paralelo.
- **Dentro de uma consulta, vários agregados são permitidos**: `totalCount`,
  `sumAmountAmountMicros`, `avgAmountAmountMicros` saem juntos para o mesmo filtro.
- **Agrupamento é `opportunitiesGroupBy`**, com `groupBy: [{ origem: true }]` ou
  `[{ createdAt: { granularity: DAY, timeZone } }]`. Cada grupo traz
  `groupByDimensionValues` (a chave, `null` para vazio) e os mesmos agregados.
  Dono vem como `ownerId`; o nome sai de uma consulta a `workspaceMembers`.
- **Duas dimensões** no mesmo agrupamento funcionam: `[{ stage: true }, { ownerId: true }]`
  devolve `groupByDimensionValues` com duas chaves, na ordem pedida. É o que alimenta o
  gráfico empilhado, e de um só agrupamento saem quatro quadros (total em aberto, sem
  dono, em negociação e o empilhado).
- **SVG no componente**: o renderizador só deixa passar atributos de uma lista fixa.
  `line` não aceita coordenadas, então toda linha é um `path`. Tamanho de fonte de
  `text` vai por `style`, não por atributo.
- **A linha do tempo é `timelineActivities`**, com `properties` em JSON. A busca roda
  contra o texto do JSON, e é assim que ele sai: `{"diff": {"stage": {"after": "WON",
  "before": "EM_NEGOCIACAO"}}}` — com espaço depois dos dois-pontos, o que importa para
  o `like` casar. Paginação por `offset`, com `id` como segundo critério de ordem.
- **`id: { in: [...] }` funciona** no filtro de negócio: é assim que o cohort pergunta
  "como estão hoje" para uma lista de identificadores.

Números de agosto/2026 pela API, para conferir o seletor em "Mês passado": 622 criados,
128 vendas, R$ 20.154,90 de receita, ticket R$ 157,46, conversão 17,2% (107 ganhos entre
os 622 criados), 195 sem origem.

## As três regras de filtro

Estão em `src/painel/dados.ts`, no topo de `buscarDados`, e valem para tudo:

- **Lead** → `Funil = Vendas` + `Data de criação` dentro do período
- **Venda** → `Funil = Vendas` + `Etapa = Won` + `Data de fechamento` dentro do período
- **Pipeline** → `Funil = Vendas` + etapa em aberto — **sem data**, porque é foto de agora

Contou lead, usa data de criação. Contou venda, usa data de fechamento. Trocar os dois
é o erro mais fácil de cometer e o mais difícil de perceber: os totais continuam
plausíveis. Já aconteceu três vezes durante a montagem manual.

## Detalhes que custaram para descobrir

- **`timeZone` fixo em `America/Sao_Paulo`** em todo agrupamento por data. Sem isso o
  CRM agrupa pelo fuso de quem está olhando e duas pessoas veem dias diferentes.
- **Brasília não tem horário de verão desde 2019**, então o deslocamento `-03:00` é fixo
  e fica num lugar só, em `periodo.ts`.
- **Data em texto `AAAA-MM-DD`, nunca objeto `Date`** nas contas de período: `Date` usa o
  fuso de quem está olhando e erra o dia.

### Do tempo dos gráficos nativos

Não valem mais para este app, que não usa nenhum, mas valem para quem montar gráfico
pela tela do CRM:

- **Filtro de lista** grava o valor como array JSON em texto: `'["WON"]'`.
- **Filtro de data relativo** grava texto no formato `THIS_1_MONTH;;America/Sao_Paulo;;MONDAY;;`
  com operando `IS_RELATIVE`. Data fixa é `IS_AFTER` e ISO puro.
- **"Contar todos" ignora o campo escolhido** — conta registros.
- **Gráfico de campo de lista não desenha o vazio**; o de campo de relação desenha, como
  "Not Set". Foi o motivo de existir um número "Sem origem" separado, que aqui virou
  barra própria.

## Como publicar

**Na VPS**, pelo script, igual à cadência. A VPS tem Node 18 e não tem yarn, então o
script roda tudo num container `node:22` descartável e lê a chave de
`petbee/sync/.env` — ninguém digita credencial.

```bash
cd /opt/twenty-repo/petbee/deploy
./publicar-paineis.sh            # PLANO: mostra o que mudaria, não escreve nada
./publicar-paineis.sh apply      # publica de verdade, sem apagar nada
./publicar-paineis.sh remover    # publica APAGANDO o que saiu do código
```

O `apply` de propósito **não apaga**: um plano com "to destroy" para e aparece, em vez
de passar batido. Quando a remoção é intencional, `remover` passa o `-f` do CLI e pede
que você digite `APAGAR` antes. O container não tem terminal interativo, então sem o
`-f` o CLI travaria na própria pergunta de confirmação.

O código chega na VPS pelo `deploy.yml`, que roda a cada push na `main`. Como a produção
usa imagem pronta (`twentycrm/twenty:${TAG}`) e não compila do fonte, um merge que só
adiciona pasta de app é praticamente no-op para os contêineres.

Para desfazer, apague a página pela tela. Nada aqui altera negócio — o papel do app
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

## Conferência da comparação

"Este mês" (01 a 16/09) contra "01 a 16/08", medido pela API em 16/09/2026:

| | Setembro (16 dias) | Agosto (16 dias) | Variação |
|---|---|---|---|
| Negócios criados | 387 | 281 | +38% |
| Vendas | 27 | 56 | −52% |
| Receita | R$ 4.062,20 | R$ 8.113,90 | −50% |
| Ticket médio | R$ 150,45 | R$ 144,89 | +3,8% |
| Conversão | 7,0% | 16,0% | −9,0 p.p. |
| Sem origem | 71 | 98 | −28% |
| Perdidos com contato real (na época, "Perdas com conversa") | 44 | 102 | −57% |

As linhas por dia de 01 a 16/08, para conferir a linha cinza: criados
10, 16, 28, 28, 26, 18, 16, 10, 8, 21, 25, 24, 20, 10, 12, 9 (soma 281); vendas
0, 7, 1, 4, 1, 9, 0, 0, 11, 4, 5, 4, 6, 1, 1, 2 (soma 56).

O "antes" das barras, mesmo período de 01 a 16/08:

| Barra | Valores de 01 a 16/08 |
|---|---|
| Negócios por origem | Sem origem 98, Google Ads 59, Cadastro Direto 47, Facebook Ads 40, Organic Search 17, Indicação-Cliente 8, Cliente 8, Indicação-Clínica 2, Parceiros 1, Tour 1 |
| Negócios por canal | Formulário 122, WhatsApp 109, Onboarding 50 |
| Vendas por origem | Google Ads 18, Cadastro Direto 12, Cliente 9, Organic Search 6, Indicação-Cliente 6, Indicação-Clínica 2, Facebook Ads 2, Outros 1 |
| Vendas por vendedor | Lucas 55, Rodrigo 1 |

**Tour** é o caso de teste da categoria que sumiu: tinha 1 em agosto e nenhum em
setembro, então aparece com barra vazia e −100%.

Conferido em 16/09: o agrupamento por origem soma exatamente o mesmo que o total
(388 em ambos), ou seja `opportunitiesGroupBy` não perde registro nenhum.

## Conferência da seção Vendedores

Números medidos pela API em 16/09/2026 (pipeline é foto do momento e muda sozinho):

| | |
|---|---|
| Negócios em aberto | 248 |
| Sem dono | 32 |
| Em negociação | 70 |
| Pipeline por dono | Vitoria 115, Lucas 89, Sem dono 32, Rodrigo 12 |

## Conferência do funil

Eventos de mudança de etapa em setembro/2026, medidos pela API em 16/09:

| Entrou em | Eventos |
|---|---|
| Em qualificação | 329 |
| Em negociação | 145 |
| Fechamento | 6 |
| Ganho | 36 |
| Perdido | 313 |

A tela conta **negócios distintos**, então mostra número igual ou um pouco menor que
estes: quem entrou duas vezes na mesma etapa conta uma vez.

## Conferência da tabela por vendedor

Conferido pela API em 17/09/2026 à tarde, com "Este mês" (01 a 17/09): a vendedora tinha
15 vendas com Fechamento = Comercial (13 já analisadas + 2 do dia), 7 delas sem passar por
negociação, e 144 leads chegados em setembro. Com as regras de 17/09 a tela deve mostrar:
Vendedores, Vitoria **151 recebidos, 15 ganhos, Taxa 9,9%**; Total 164 recebidos, 15
ganhos, 9,1%. Cohort "Mês", Vitoria **151 recebidos, 14 ganhos, 9,3%** (a venda do lead
de 31/08 fica no lote de agosto, antes do piso). Perdidos e Em aberto não mudam (166 e
46 naquela hora). A nota cinza deve dizer "7 venda(s) pularam a etapa de negociação".
A conferência mais antiga, abaixo, é de antes dessas regras.


Prova real feita pela API em 16/09/2026, com "Este mês" (01 a 16/09), negócio por
negócio, sem olhar nome de cliente:

| | Vendas em setembro (data de fechamento) | Entraram em negociação em setembro | Entraram em negociação em agosto | Nunca passaram por negociação |
|---|---|---|---|---|
| Vitoria | 13 | 6 | 1 (em 31/08) | 6 |
| Lucas | 15 | 0 | 0 | 15 |

Então, com "Este mês", a coluna **Ganhos** deve mostrar **Vitoria 7** (6 + 1) e
**Lucas 0**, enquanto "Vendas por vendedor" segue mostrando 13 e 15. A versão anterior
da tabela (só cohort) mostrava Vitoria 6, porque deixava de fora a venda delegada em
agosto — foi exatamente o caso que o dono do painel pediu para entrar.

As 15 vendas do Lucas são venda direta: foram de "Novo Lead" a Ganho sem passar por
negociação, e por isso ficam fora desta tabela de propósito.

A coluna **Perdidos** foi conferida do mesmo jeito em 17/09/2026, refazendo a conta por
fora do painel (eventos do histórico cruzados um a um, sem olhar nome de cliente):

| Passo | Quantos |
|---|---|
| Eventos "virou Perdido" de 01 a 16/09 | 316 |
| Negócios distintos entre eles | 314 |
| Desses, os que entraram em negociação alguma vez | 163 |
| Desses, os que ainda existem no CRM (1 foi apagado) | 162 |
| Por dono | Vitoria 153, Rodrigo 6, Lucas 3 |
| Desses, os que continuam em Perdido hoje | 156 |
| Por dono, regra final | **Vitoria 147, Rodrigo 6, Lucas 3** |

A tela com a regra antiga mostrava exatamente 153, 6 e 3. O negócio apagado some da
tabela sozinho, porque o agrupamento por dono só enxerga negócios que existem.

Os seis que saem na regra final são todos da Vitoria: quatro voltaram para negociação, um
foi para Break e um virou Ganho. Com "Este mês" a tela deve mostrar Perdidos 147 / 6 / 3
e taxa da Vitoria 7 ÷ (7 + 147) = 4,5%.

## Conferência da visão Cohort

Contas refeitas por fora do painel em 17/09/2026, negócio por negócio, com os 259
negócios que entraram em negociação desde 23/08 (261 no histórico, 2 apagados). Foi
**antes do piso de 01/09**; com o piso, as duas primeiras linhas somem e a de 26/08 a
01/09 fica só com o dia 01/09. Com o botão "8 semanas" e "Agrupar por: Semana", a tela
mostrava:

| Cohort | Recebidos | Ganhos | Perdidos | Em aberto | Conversão | Receita | Ticket médio | Até vender |
|---|---|---|---|---|---|---|---|---|
| 19 a 25/08 | 57 | 5 | 43 | 9 | 8,8% | R$ 919,30 | R$ 183,86 | 2,4 d |
| 26/08 a 01/09 | 59 | 1 | 57 | 1 | 1,7% | R$ 109,90 | R$ 109,90 | 1,1 d |
| 02 a 08/09 | 48 | 2 | 35 | 11 | 4,2% | R$ 239,80 | R$ 119,90 | 1,5 d |
| 09 a 15/09 | 85 | 4 | 39 | 42 | 4,7% | R$ 719,60 | R$ 179,90 | 1,0 d |
| 16 a 22/09 | 10 | 0 | 1 | 9 | 0% | R$ 0,00 | — | — |
| Total | 259 | 12 | 175 | 72 | 4,6% | R$ 1.988,60 | R$ 165,72 | 1,7 d |

Os números de "em aberto" e dos cohorts recentes mudam sozinhos com o tempo; os das
cohorts maduros (até 01/09) devem bater exatamente. As três semanas de 29/07 a 18/08
saem zeradas, porque o histórico não existia.

Grade vendedor × cohort (ganhos/recebidos):

| Vendedor | 19 a 25/08 | 26/08 a 01/09 | 02 a 08/09 | 09 a 15/09 | 16 a 22/09 | Total |
|---|---|---|---|---|---|---|
| Vitoria | 5/55 | 0/54 | 1/46 | 4/73 | 0/8 | 10/236 |
| Rodrigo | — | 0/4 | 0/1 | 0/11 | — | 0/16 |
| Lucas | 0/2 | — | — | 0/1 | 0/2 | 0/5 |
| Sem dono | — | 1/1 | 1/1 | — | — | 2/2 |

Por mês: agosto 115 recebidos, 6 ganhos, 99 perdidos, 10 em aberto (5,2%); setembro
até 16/09, 144 recebidos, 6 ganhos, 76 perdidos, 62 em aberto (4,2%).

Dois achados dessa conferência, para o dono do painel olhar: dois negócios entraram em
negociação e viraram venda **sem dono**; e na semana de 26/08 a 01/09 a conversão foi
1,7% contra 4 a 9% nas outras.

## Conferência da jornada

Só uma ordem de grandeza, medida pela API em 17/09 com as linhas de setembro (01 a 16):
das 316 linhas "virou Perdido", 161 vinham de Em negociação, 93 de Em qualificação, 53 de
Novo Lead, 7 de Break e 1 de Fechamento; das 36 linhas "virou Ganho", 23 vinham de Novo
Lead (venda direta), 8 de Em negociação, 2 de Em qualificação, 2 de Perdido (reaberto e
vendido) e 1 era "Ganho para Ganho", que não conta. Na lente "próximo passo" as colunas
Ganho e Perdido devem ficar perto disso; não iguais, porque a tabela conta pela data da
entrada e não pela data da saída.

## O que ainda não está aqui

- **Quem clicou em cada mudança de etapa.** A maioria é a automação; o campo de pessoa
  não serve. O recorte por vendedor existe, mas pelo dono atual do negócio (ver acima).
- **Tempo até fechar** (dias entre entrar em negociação e virar Ganho). Dá para tirar do
  mesmo histórico; ainda não foi pedido.
- **Vendas diretas, que não passam por negociação.** Hoje ficam fora da tabela por
  vendedor e do Cohort e só aparecem em "Vendas por vendedor". Se um dia devem entrar, e
  como, é decisão de processo que o dono do painel adiou.
- **No Cohort: motivos de perda por vendedor, receita por lead recebido e um gráfico de
  linha da conversão por cohort.** Foram discutidos em 17/09/2026 e deixados de fora de
  propósito; a linha faz sentido quando houver uns oito cohorts.
- **"Sem origem" como categoria de verdade.** São ~70 negócios por mês sem origem
  preenchida. Depende de mexer no rastreamento, que está congelado até 22/09/2026.

Dado levantado pela API: das 36 transições para Ganho em setembro, a maior parte veio
direto de "Novo Lead", sem passar pelo funil. É o que o quadro "O que aconteceu no
período" mostra de cara — os degraus não afunilam.

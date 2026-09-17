// Os textos dos blocos "Como ler". Ficam num arquivo só para serem lidos e
// corrigidos como texto, sem mexer nas telas. Escritos para quem nunca viu o
// painel: frases curtas, sem termo técnico, na ordem em que a tela aparece.

export const GUIA_PAINEL = [
  'O seletor de datas no topo vale para todas as visões. O que "período" significa muda um pouco em cada uma, e cada visão diz isso na primeira linha.',
  'Tudo é lido do CRM ao vivo, em horário de Brasília. O painel só lê; nunca altera nada.',
  '"Comparar com o período anterior" mostra, embaixo de cada número, o valor de antes e a variação. "Este mês" compara com o mesmo trecho do mês passado; os outros botões comparam com o bloco de mesmo tamanho logo antes.',
  'Cores: verde é venda ou algo bom subindo; vermelho é perda ou algo ruim subindo; azul é "em aberto"; laranja é aviso, leia antes de confiar no número.',
  'Traço (—) é zero ou "não se aplica". Cinza e itálico é "poucos dados para tirar conclusão".',
  'As quatro visões: Visão geral (o período em números), Funil (por onde os leads passam), Vendedores (o que cada pessoa fechou), Cohort (quanto cada lote de leads converte).',
  'Um aviso laranja dizendo que um quadro "não carregou" quer dizer que aquele número está zerado por erro, não porque foi zero de verdade.',
];

export const GUIA_VISAO_GERAL = [
  'Negócios criados: cards do funil Vendas criados no período, pela data de criação.',
  'Vendas, Receita e Ticket médio: negócios em Ganho, pela data de fechamento. Uma venda de um lead antigo conta no dia em que fechou.',
  'Conversão: dos criados no período, quantos já viraram venda. Em período recente esse número ainda sobe, porque tem lead em aberto.',
  'Sem origem: criados sem a origem preenchida. Nos gráficos aparece como uma barra própria, para não sumir.',
  'Linhas por dia: com "Comparar" ligado, a linha cinza tracejada é o período anterior, na mesma escala.',
  'Barras por origem e canal: de um lado os negócios criados, do outro as vendas. Uma categoria com −100% existia antes e não apareceu agora.',
];

export const GUIA_FUNIL = [
  'Aqui o período é a data em que o lead ENTROU na etapa.',
  '"O que aconteceu no período" conta as passagens por cada degrau dentro do período. Dividir um degrau pelo outro NÃO é conversão: o lead pode ter entrado em negociação no mês passado e fechado agora.',
  '"De cada etapa, para onde foi": cada linha é uma etapa de partida e soma 100%. Próximo passo = a primeira porta que o lead pegou depois de entrar. Situação hoje = a sala onde ele está agora, não importa o caminho.',
  'As duas lentes não se subtraem. "Entraram" muda um pouco entre elas: Próximo passo conta entradas (quem voltou conta duas vezes); Situação hoje conta negócios.',
  '"Dos que entraram em negociação no período, como estão hoje": essa sim é conversão, e é a mesma conta da visão Cohort.',
  'Conta a partir de 01/09/2026. Antes disso o processo ainda estava sendo ajustado, e a tela avisa se a data escolhida for anterior.',
];

export const GUIA_VENDEDORES = [
  'A tabela do topo responde "o que cada vendedor fechou neste período".',
  'Ganhos: vendas do período (data de fechamento) que o campo Fechamento do negócio marca como Comercial, para o dono do card. Direto e Recompra ficam fora. É a regra de comissão: o campo é preenchido pela automação da venda e conferido pelo gerente comercial.',
  'Venda sem o campo Fechamento entra só se passou por negociação ou se um vendedor marcou o Ganho à mão, e aparece numa lista laranja abaixo da tabela para o gerente preencher no CRM.',
  'Recebidos: leads que a IA entregou à pessoa no período. Perdidos: perderam no período, tendo passado por negociação, e continuam em Perdido. Por isso Recebidos − Ganhos − Perdidos não dá Em aberto.',
  'Venda direta, que não passou pelo comercial, fica fora desta tabela e aparece só em "Vendas por vendedor".',
  'Taxa: ganhos sobre ganhos + perdidos. Receita e Ticket médio: só dos ganhos.',
  'Pipeline (em aberto, sem dono, em negociação, por dono, por etapa) é foto de agora e não muda com o período.',
  'O lead conta para o dono atual: se foi repassado, conta para quem está com ele hoje.',
  'Para comparar pessoas com justiça, use a visão Cohort: lá o de cima e o de baixo da fração são os mesmos leads.',
];

export const GUIA_COHORT = [
  'Aqui o período é a data em que o lead CHEGOU no vendedor (entrou em negociação). Cada negócio conta uma vez, no cohort da primeira entrada.',
  'Cada linha é um lote: dos leads que chegaram naquela semana ou mês, quantos viraram venda até hoje. É a medida justa de conversão, porque a limpeza de leads antigos não mexe nela.',
  'Semana comercial de quarta a terça.',
  '"Maduro" = a semana fechou há 14 dias ou mais; antes disso o número ainda muda. "Parcial" = o período escolhido cortou a semana. "Em andamento" = a semana atual.',
  'Na grade, "Mostrar" troca o número da célula. Cinza e itálico: menos de 30 leads, a taxa ali é sorte, não desempenho.',
  '"Detalhe de" abre a tabela de uma pessoa. "vs. time" é a conversão dela menos a do time no mesmo cohort, em pontos percentuais.',
  'Lead que volta e ganha negócio novo entra no cohort do negócio novo. Venda direta fica fora.',
];

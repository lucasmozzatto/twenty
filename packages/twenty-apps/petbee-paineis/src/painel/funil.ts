// O funil pelo histórico de etapa.
//
// O campo Etapa guarda só o estado de hoje: um negócio que passou por
// "Em negociação" e virou Ganho aparece apenas como Ganho. Quem guarda o
// caminho é a linha do tempo, uma linha por mudança, com a etapa de antes e a
// de depois em JSON. Gráfico nativo não abre JSON; aqui a gente lê e conta.
//
// São DUAS medidas diferentes, e misturá-las é o erro clássico:
//
//   FLUXO  — o que aconteceu dentro do período. Um negócio ganho em setembro
//            pode ter entrado em negociação em agosto, então a razão entre um
//            degrau e outro NÃO é taxa de conversão.
//   SAFRA  — dos que entraram em negociação DENTRO do período, como estão
//            hoje. Essa sim é conversão, e é a que responde "falamos com
//            quantos e fechamos quantos".
import { agrupar, consultar, type Filtro } from 'src/painel/crm';
import { type Falha, tentar } from 'src/painel/dados';
import { limitesIso, type Periodo } from 'src/painel/periodo';
import { ETAPAS_EM_NEGOCIACAO } from 'src/painel/rotulos';

// 200 é o teto do servidor por consulta (QUERY_MAX_RECORDS). O teto de páginas
// evita pendurar a tela num intervalo gigante: hoje são ~900 mudanças por mês,
// então 40 páginas dão folga para uns três anos.
const POR_PAGINA = 200;
const MAXIMO_DE_PAGINAS = 40;

type MudancaDeEtapa = {
  targetOpportunityId: string | null;
  properties: { diff?: { stage?: { after?: string; before?: string } } } | null;
};

export type Funil = {
  // Fluxo: negócios distintos que ENTRARAM em cada etapa dentro do período.
  entrouQualificacao: number;
  entrouNegociacao: number;
  virouGanho: number;
  virouPerdido: number;
  // Safra: como estão HOJE os que entraram em negociação dentro do período.
  negociacaoTotal: number;
  negociacaoGanhos: number;
  negociacaoPerdidos: number;
  negociacaoEmAberto: number;
  // Antes desta data não existe histórico: o CRM não gravava ainda.
  historicoComecaEm: string | null;
  // Verdadeiro quando o período pedido começa antes do histórico existir.
  periodoIncompleto: boolean;
  // Verdadeiro quando bateu no teto de páginas e os números estão por baixo.
  truncado: boolean;
  falhas: Falha[];
};

const FUNIL_VAZIO: Omit<Funil, 'historicoComecaEm' | 'periodoIncompleto' | 'falhas'> = {
  entrouQualificacao: 0,
  entrouNegociacao: 0,
  virouGanho: 0,
  virouPerdido: 0,
  negociacaoTotal: 0,
  negociacaoGanhos: 0,
  negociacaoPerdidos: 0,
  negociacaoEmAberto: 0,
  truncado: false,
};

// Paginação por `offset` com ordem fixa, e não por cursor: o cursor parou na
// primeira página em produção e o funil saiu por baixo sem avisar. `totalCount`
// vem junto de propósito — é ele que permite saber se lemos tudo.
const CONSULTA_MUDANCAS = `
  query Mudancas($filter: TimelineActivityFilterInput, $offset: Int) {
    timelineActivities(
      filter: $filter
      first: ${POR_PAGINA}
      offset: $offset
      orderBy: [{ happensAt: AscNullsLast }]
    ) {
      totalCount
      edges { node { targetOpportunityId properties } }
    }
  }
`;

const buscarMudancas = async (
  periodo: Periodo,
): Promise<{ mudancas: MudancaDeEtapa[]; truncado: boolean }> => {
  const { inicio, fim } = limitesIso(periodo);
  const filter: Filtro = {
    and: [
      { targetOpportunityId: { is: 'NOT_NULL' } },
      // O JSON vira texto na busca, e é assim que ele sai: `"stage": {...}`.
      { properties: { like: '%"stage"%' } },
      { happensAt: { gte: inicio } },
      { happensAt: { lt: fim } },
    ],
  };

  const mudancas: MudancaDeEtapa[] = [];
  let total = 0;

  for (let pagina = 0; pagina < MAXIMO_DE_PAGINAS; pagina += 1) {
    const dados = await consultar<{
      timelineActivities: {
        totalCount: number;
        edges: { node: MudancaDeEtapa }[];
      };
    }>(CONSULTA_MUDANCAS, { filter, offset: mudancas.length });

    const conexao = dados.timelineActivities;

    total = conexao.totalCount;

    for (const borda of conexao.edges) mudancas.push(borda.node);

    // Página incompleta significa fim da lista. Página vazia também, e a
    // checagem evita laço infinito se o servidor devolver nada.
    if (conexao.edges.length < POR_PAGINA) break;
  }

  // Compara o que foi lido com o que existe. Antes isso era um `false` fixo, e
  // por isso uma leitura pela metade passou como se fosse completa.
  return { mudancas, truncado: mudancas.length < total };
};

// Negócios DISTINTOS que entraram nestas etapas. Distinto importa: um negócio
// pode voltar para negociação depois de um Break, e contar duas vezes inflaria
// o funil.
const negociosQueEntraramEm = (
  mudancas: MudancaDeEtapa[],
  etapas: string[],
): Set<string> => {
  const negocios = new Set<string>();

  for (const mudanca of mudancas) {
    const depois = mudanca.properties?.diff?.stage?.after;

    if (
      depois !== undefined &&
      etapas.includes(depois) &&
      mudanca.targetOpportunityId !== null
    ) {
      negocios.add(mudanca.targetOpportunityId);
    }
  }

  return negocios;
};

// A data em que a linha do tempo começou a gravar. Antes disso o histórico
// simplesmente não existe, e um funil daquele período sairia por baixo.
const buscarInicioDoHistorico = async (): Promise<string | null> => {
  const dados = await consultar<{
    timelineActivities: { minHappensAt: string | null };
  }>(
    `query InicioDoHistorico($filter: TimelineActivityFilterInput) {
      timelineActivities(filter: $filter) { minHappensAt }
    }`,
    { filter: { targetOpportunityId: { is: 'NOT_NULL' } } },
  );

  const minimo = dados.timelineActivities.minHappensAt;

  return minimo === null ? null : minimo.slice(0, 10);
};

// Como estão HOJE os negócios da safra. Uma consulta só, agrupada por etapa.
const situacaoDeHoje = async (negocios: string[]) => {
  if (negocios.length === 0) return { ganhos: 0, perdidos: 0, emAberto: 0 };

  const grupos = await agrupar({ id: { in: negocios } }, [{ stage: true }]);

  const porEtapa = (etapa: string) =>
    grupos.find((grupo) => grupo.chaves[0] === etapa)?.contagem ?? 0;

  const ganhos = porEtapa('WON');
  const perdidos = porEtapa('LOST');

  return {
    ganhos,
    perdidos,
    emAberto: negocios.length - ganhos - perdidos,
  };
};

export const buscarFunil = async (periodo: Periodo): Promise<Funil> => {
  const falhas: Falha[] = [];

  const [historicoComecaEm, coleta] = await Promise.all([
    tentar('início do histórico', buscarInicioDoHistorico(), null, falhas),
    tentar(
      'histórico de etapas',
      buscarMudancas(periodo),
      { mudancas: [] as MudancaDeEtapa[], truncado: false },
      falhas,
    ),
  ]);

  const emNegociacao = negociosQueEntraramEm(
    coleta.mudancas,
    ETAPAS_EM_NEGOCIACAO,
  );

  const safra = await tentar(
    'situação da safra em negociação',
    situacaoDeHoje([...emNegociacao]),
    { ganhos: 0, perdidos: 0, emAberto: 0 },
    falhas,
  );

  return {
    ...FUNIL_VAZIO,
    entrouQualificacao: negociosQueEntraramEm(coleta.mudancas, [
      'EM_QUALIFICACAO',
    ]).size,
    entrouNegociacao: emNegociacao.size,
    virouGanho: negociosQueEntraramEm(coleta.mudancas, ['WON']).size,
    virouPerdido: negociosQueEntraramEm(coleta.mudancas, ['LOST']).size,
    negociacaoTotal: emNegociacao.size,
    negociacaoGanhos: safra.ganhos,
    negociacaoPerdidos: safra.perdidos,
    negociacaoEmAberto: safra.emAberto,
    historicoComecaEm,
    periodoIncompleto:
      historicoComecaEm !== null && periodo.de < historicoComecaEm,
    truncado: coleta.truncado,
    falhas,
  };
};

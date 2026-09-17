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
//   COHORT  — dos que entraram em negociação DENTRO do período, como estão
//            hoje. Essa sim é conversão, e é a que responde "falamos com
//            quantos e fechamos quantos".
import { agrupar, consultar } from 'src/painel/crm';
import { type Falha, tentar } from 'src/painel/dados';
import {
  listarMudancas,
  type MudancaDeEtapa,
  negociosQueEntraramEm,
  SO_NEGOCIOS,
} from 'src/painel/linha-do-tempo';
import { limitesIso, type Periodo } from 'src/painel/periodo';
import { ETAPAS_EM_NEGOCIACAO } from 'src/painel/rotulos';

export type CohortPorVendedor = {
  chave: string | null;
  recebidos: number;
  ganhos: number;
  perdidos: number;
  emAberto: number;
};

export type Funil = {
  // Fluxo: negócios distintos que ENTRARAM em cada etapa dentro do período.
  entrouQualificacao: number;
  entrouNegociacao: number;
  virouGanho: number;
  virouPerdido: number;
  // Cohort: como estão HOJE os que entraram em negociação dentro do período.
  negociacaoTotal: number;
  negociacaoGanhos: number;
  negociacaoPerdidos: number;
  negociacaoEmAberto: number;
  // O mesmo cohort, aberto por dono. Ordenado por recebidos; "Sem dono" no fim.
  porVendedor: CohortPorVendedor[];
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
  porVendedor: [],
  truncado: false,
};

// Paginação por `offset` com ordem fixa, e não por cursor: o cursor parou na
// primeira página em produção e o funil saiu por baixo sem avisar. `totalCount`
// vem junto de propósito — é ele que permite saber se lemos tudo.
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

// Como estão HOJE os negócios do cohort. Dono e etapa juntos num agrupamento
// só: dele saem o total do cohort e a tabela por vendedor.
type Situacao = {
  ganhos: number;
  perdidos: number;
  emAberto: number;
  porVendedor: CohortPorVendedor[];
};

const SITUACAO_VAZIA: Situacao = {
  ganhos: 0,
  perdidos: 0,
  emAberto: 0,
  porVendedor: [],
};

const situacaoDeHoje = async (negocios: string[]): Promise<Situacao> => {
  if (negocios.length === 0) return SITUACAO_VAZIA;

  const grupos = await agrupar({ id: { in: negocios } }, [
    { ownerId: true },
    { stage: true },
  ]);

  const porDono = new Map<string | null, CohortPorVendedor>();

  for (const grupo of grupos) {
    const dono = grupo.chaves[0] ?? null;
    const etapa = grupo.chaves[1];
    const linha = porDono.get(dono) ?? {
      chave: dono,
      recebidos: 0,
      ganhos: 0,
      perdidos: 0,
      emAberto: 0,
    };

    linha.recebidos += grupo.contagem;
    if (etapa === 'WON') linha.ganhos += grupo.contagem;
    else if (etapa === 'LOST') linha.perdidos += grupo.contagem;
    else linha.emAberto += grupo.contagem;

    porDono.set(dono, linha);
  }

  // Quem recebeu mais primeiro; "Sem dono" sempre no fim, porque não é pessoa.
  const porVendedor = [...porDono.values()].sort((a, b) => {
    if (a.chave === null) return 1;
    if (b.chave === null) return -1;

    return b.recebidos - a.recebidos;
  });

  const somar = (campo: 'ganhos' | 'perdidos' | 'emAberto') =>
    porVendedor.reduce((total, linha) => total + linha[campo], 0);

  return {
    ganhos: somar('ganhos'),
    perdidos: somar('perdidos'),
    emAberto: somar('emAberto'),
    porVendedor,
  };
};

export const buscarFunil = async (periodo: Periodo): Promise<Funil> => {
  const falhas: Falha[] = [];

  const { inicio, fim } = limitesIso(periodo);

  const [historicoComecaEm, coleta] = await Promise.all([
    tentar('início do histórico', buscarInicioDoHistorico(), null, falhas),
    tentar(
      'histórico de etapas',
      listarMudancas({
        and: [
          SO_NEGOCIOS,
          { properties: { like: '%"stage"%' } },
          { happensAt: { gte: inicio } },
          { happensAt: { lt: fim } },
        ],
      }),
      { mudancas: [] as MudancaDeEtapa[], truncado: false },
      falhas,
    ),
  ]);

  const emNegociacao = negociosQueEntraramEm(
    coleta.mudancas,
    ETAPAS_EM_NEGOCIACAO,
  );

  const cohort = await tentar(
    'situação do cohort em negociação',
    situacaoDeHoje([...emNegociacao]),
    SITUACAO_VAZIA,
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
    negociacaoGanhos: cohort.ganhos,
    negociacaoPerdidos: cohort.perdidos,
    negociacaoEmAberto: cohort.emAberto,
    porVendedor: cohort.porVendedor,
    historicoComecaEm,
    periodoIncompleto:
      historicoComecaEm !== null && periodo.de < historicoComecaEm,
    truncado: coleta.truncado,
    falhas,
  };
};

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
import { limitesIso, type Periodo, recortarNoHistorico } from 'src/painel/periodo';
import { ETAPAS_EM_NEGOCIACAO } from 'src/painel/rotulos';

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
  // Antes desta data não existe histórico: o CRM não gravava ainda.
  historicoComecaEm: string | null;
  // Verdadeiro quando o período pedido começa antes do histórico existir.
  periodoIncompleto: boolean;
  // O período de fato contado, já com o piso de 01/09/2026 aplicado.
  periodo: Periodo;
  // Verdadeiro quando o período pedido começava antes do piso.
  cortadoNoInicio: boolean;
  // Verdadeiro quando bateu no teto de páginas e os números estão por baixo.
  truncado: boolean;
  falhas: Falha[];
};

const FUNIL_VAZIO: Omit<
  Funil,
  'historicoComecaEm' | 'periodoIncompleto' | 'periodo' | 'cortadoNoInicio' | 'falhas'
> = {
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

// Como estão HOJE os negócios que entraram em negociação no período: daqui
// saem os totais do cohort desta visão. A abertura por vendedor mora na visão
// Cohort e na tabela de Vendedores, que leem `cohort.ts`.
type Situacao = {
  ganhos: number;
  perdidos: number;
  emAberto: number;
};

const SITUACAO_VAZIA: Situacao = { ganhos: 0, perdidos: 0, emAberto: 0 };

const situacaoDeHoje = async (negocios: string[]): Promise<Situacao> => {
  if (negocios.length === 0) return SITUACAO_VAZIA;

  const grupos = await agrupar({ id: { in: negocios } }, [{ stage: true }]);
  const situacao = { ...SITUACAO_VAZIA };

  for (const grupo of grupos) {
    const etapa = grupo.chaves[0];

    if (etapa === 'WON') situacao.ganhos += grupo.contagem;
    else if (etapa === 'LOST') situacao.perdidos += grupo.contagem;
    else situacao.emAberto += grupo.contagem;
  }

  return situacao;
};

export const buscarFunil = async (periodoPedido: Periodo): Promise<Funil> => {
  const falhas: Falha[] = [];

  const { periodo, cortado } = recortarNoHistorico(periodoPedido);
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
    historicoComecaEm,
    periodoIncompleto:
      historicoComecaEm !== null && periodo.de < historicoComecaEm,
    periodo,
    cortadoNoInicio: cortado,
    truncado: coleta.truncado,
    falhas,
  };
};

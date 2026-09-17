// O cohort: os negócios que entraram em negociação pela PRIMEIRA vez dentro do
// período, com a situação de hoje de cada um. É a base da visão Cohort, que
// responde "dos leads que chegaram no vendedor nesta semana, quantos viraram
// venda". Entrar em negociação é o instante em que a IA entrega o lead a uma
// pessoa, então "chegou no vendedor" e "entrou em negociação" são o mesmo.
//
// Cada negócio é uma unidade, não a pessoa: lead que voltou meses depois e
// ganhou negócio novo entra no cohort em que o negócio novo chegou. Foi assim
// que o dono do painel definiu em 17/09/2026.
import { deMicros, listarNegocios } from 'src/painel/crm';
import { type Falha, tentar } from 'src/painel/dados';
import {
  filtroDeEntradaEm,
  listarMudancas,
  type MudancaDeEtapa,
  negociosQuePassaramPor,
  SO_NEGOCIOS,
} from 'src/painel/linha-do-tempo';
import { diaEmBrasilia, limitesIso, type Periodo } from 'src/painel/periodo';
import { ETAPAS_EM_NEGOCIACAO } from 'src/painel/rotulos';

export type NegocioDoCohort = {
  id: string;
  // Instante e dia (Brasília) em que entrou em negociação pela primeira vez.
  entrouEm: string;
  entrouNoDia: string;
  ownerId: string | null;
  stage: string;
  closeDate: string | null;
  valor: number | null;
};

export type Cohort = {
  negocios: NegocioDoCohort[];
  truncado: boolean;
  falhas: Falha[];
};

type SituacaoDoNegocio = {
  id: string;
  ownerId: string | null;
  stage: string;
  closeDate: string | null;
  amount: { amountMicros: number | null } | null;
};

const TAMANHO_DO_LOTE = 150;

// Situação de hoje dos negócios, em lotes. Negócio apagado não volta, e por
// isso some do cohort: não dá para contar o que não existe mais.
const situacaoDosNegocios = async (
  ids: string[],
): Promise<{ negocios: SituacaoDoNegocio[]; truncado: boolean }> => {
  const negocios: SituacaoDoNegocio[] = [];
  let truncado = false;

  for (let inicio = 0; inicio < ids.length; inicio += TAMANHO_DO_LOTE) {
    const lote = ids.slice(inicio, inicio + TAMANHO_DO_LOTE);
    const pagina = await listarNegocios<SituacaoDoNegocio>(
      { id: { in: lote } },
      'id ownerId stage closeDate amount { amountMicros }',
    );

    negocios.push(...pagina.nos);
    truncado = truncado || pagina.truncado;
  }

  return { negocios, truncado };
};

export const buscarCohort = async (periodo: Periodo): Promise<Cohort> => {
  const { inicio, fim } = limitesIso(periodo);
  const falhas: Falha[] = [];

  // Todas as entradas em negociação do período, da mais antiga para a mais
  // nova: a primeira que aparecer para cada negócio é a data de entrada dele.
  const entradas = await tentar(
    'entradas em negociação',
    listarMudancas({
      and: [
        SO_NEGOCIOS,
        filtroDeEntradaEm(ETAPAS_EM_NEGOCIACAO),
        { happensAt: { gte: inicio } },
        { happensAt: { lt: fim } },
      ],
    }),
    { mudancas: [] as MudancaDeEtapa[], truncado: false },
    falhas,
  );

  const primeiraEntrada = new Map<string, string>();

  for (const mudanca of entradas.mudancas) {
    const depois = mudanca.properties?.diff?.stage?.after;

    if (mudanca.targetOpportunityId === null || depois === undefined) continue;
    if (!ETAPAS_EM_NEGOCIACAO.includes(depois)) continue;
    if (!primeiraEntrada.has(mudanca.targetOpportunityId)) {
      primeiraEntrada.set(mudanca.targetOpportunityId, mudanca.happensAt);
    }
  }

  // Quem já tinha entrado em negociação ANTES do período pertence ao cohort de
  // lá, não a esta: um lead que voltou do Break não é lead novo.
  const veteranos = await tentar(
    'entradas anteriores ao período',
    negociosQuePassaramPor(
      [...primeiraEntrada.keys()],
      ETAPAS_EM_NEGOCIACAO,
      [{ happensAt: { lt: inicio } }],
    ),
    new Set<string>(),
    falhas,
  );

  const novos = [...primeiraEntrada.keys()].filter((id) => !veteranos.has(id));

  const situacao = await tentar(
    'situação dos negócios do cohort',
    situacaoDosNegocios(novos),
    { negocios: [] as SituacaoDoNegocio[], truncado: false },
    falhas,
  );

  const negocios = situacao.negocios.map((negocio) => {
    const entrouEm = primeiraEntrada.get(negocio.id) ?? '';

    return {
      id: negocio.id,
      entrouEm,
      entrouNoDia: diaEmBrasilia(new Date(entrouEm)),
      ownerId: negocio.ownerId,
      stage: negocio.stage,
      closeDate: negocio.closeDate,
      valor: deMicros(negocio.amount?.amountMicros),
    };
  });

  return {
    negocios,
    truncado: entradas.truncado || situacao.truncado,
    falhas,
  };
};

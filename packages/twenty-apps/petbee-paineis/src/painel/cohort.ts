// O cohort: os negócios que entraram em negociação pela PRIMEIRA vez dentro do
// período, com a situação de hoje de cada um. É a base da visão Cohort, que
// responde "dos leads que chegaram no vendedor nesta semana, quantos viraram
// venda". Entrar em negociação é o instante em que a IA entrega o lead a uma
// pessoa, então "chegou no vendedor" e "entrou em negociação" são o mesmo.
//
// Cada negócio é uma unidade, não a pessoa: lead que voltou meses depois e
// ganhou negócio novo entra no cohort em que o negócio novo chegou. Foi assim
// que o dono do painel definiu em 17/09/2026.
import { deMicros, listarNegociosPorId } from 'src/painel/crm';
import { type Falha, tentar } from 'src/painel/dados';
import { type VendaSemNegociacao } from 'src/painel/desfechos';
import {
  entrouEm,
  filtroDeEntradaEm,
  listarMudancas,
  type MudancaDeEtapa,
  negociosQuePassaramPor,
  SO_NEGOCIOS,
} from 'src/painel/linha-do-tempo';
import {
  diaEmBrasilia,
  limitesIso,
  type Periodo,
  recortarNoHistorico,
} from 'src/painel/periodo';
import { ETAPAS_EM_NEGOCIACAO } from 'src/painel/rotulos';

// O histórico de etapas não sabe de funil, então o filtro entra na busca da
// situação: negócio de outro funil que use as mesmas etapas fica fora.
export const SO_FUNIL_DE_VENDAS = { funnel: { eq: 'VENDAS' } };

export type NegocioDoCohort = {
  id: string;
  // Verdadeiro quando o negócio entrou no cohort pela venda, e não por uma
  // entrada em negociação: a "chegada" dele é a própria venda.
  pelaVenda?: boolean;
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
  // O período de fato contado, já com o piso de 01/09/2026 aplicado.
  periodo: Periodo;
  cortadoNoInicio: boolean;
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

export const buscarCohort = async (periodoPedido: Periodo): Promise<Cohort> => {
  const { periodo, cortado } = recortarNoHistorico(periodoPedido);
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
    if (mudanca.targetOpportunityId === null) continue;
    if (!entrouEm(mudanca, ETAPAS_EM_NEGOCIACAO)) continue;
    if (!primeiraEntrada.has(mudanca.targetOpportunityId)) {
      primeiraEntrada.set(mudanca.targetOpportunityId, mudanca.happensAt);
    }
  }

  // Quem já tinha entrado em negociação ANTES do período pertence ao cohort de
  // lá, não a esta: um lead que voltou do Break não é lead novo.
  const veteranos = await tentar(
    'entradas anteriores ao período',
    negociosQuePassaramPor([...primeiraEntrada.keys()], ETAPAS_EM_NEGOCIACAO, [
      { happensAt: { lt: inicio } },
    ]),
    { passaram: new Set<string>(), truncado: false },
    falhas,
  );

  const novos = [...primeiraEntrada.keys()].filter(
    (id) => !veteranos.passaram.has(id),
  );

  // Negócio apagado não volta, e por isso some do cohort: não dá para contar
  // o que não existe mais.
  const situacao = await tentar(
    'situação dos negócios do cohort',
    listarNegociosPorId<SituacaoDoNegocio>(
      novos,
      'id ownerId stage closeDate amount { amountMicros }',
      [SO_FUNIL_DE_VENDAS],
    ),
    { nos: [] as SituacaoDoNegocio[], truncado: false },
    falhas,
  );

  const negocios = situacao.nos.map((negocio) => {
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
    periodo,
    cortadoNoInicio: cortado,
    truncado: entradas.truncado || situacao.truncado || veteranos.truncado,
    falhas,
  };
};

// Junta ao cohort as vendas contadas cujo lead nunca passou por negociação:
// o vendedor recebeu o lead, só que o registro da chegada é a própria venda.
// Entram no lote do dia da venda, já em Ganho, e só dentro do período
// contado (o piso de 01/09 vale para elas também). Decisão do dono do painel
// em 17/09/2026, para as duas visões contarem o mesmo "recebido".
export const incluirVendasSemNegociacao = (
  cohort: Cohort,
  vendas: VendaSemNegociacao[],
): Cohort => {
  const { inicio, fim } = limitesIso(cohort.periodo);
  const jaNoCohort = new Set(cohort.negocios.map((negocio) => negocio.id));
  const extras = vendas
    .filter(
      (venda) =>
        !jaNoCohort.has(venda.id) && venda.closeDate >= inicio && venda.closeDate < fim,
    )
    .map((venda) => ({
      id: venda.id,
      pelaVenda: true,
      entrouEm: venda.closeDate,
      entrouNoDia: diaEmBrasilia(new Date(venda.closeDate)),
      ownerId: venda.ownerId,
      stage: 'WON',
      closeDate: venda.closeDate,
      valor: venda.valor,
    }));

  return extras.length === 0 ? cohort : { ...cohort, negocios: [...cohort.negocios, ...extras] };
};

// Os desfechos do período por vendedor: o que cada pessoa fechou e perdeu
// NESTE período, entre os leads que passaram pela mão dela. É a tabela que
// serve para comissão, e por isso a regra de "venda do vendedor" é a do
// negócio, não uma dedução do painel.
//
// GANHOS seguem o campo "Fechamento" do negócio, combinado com o dono do
// painel em 17/09/2026:
//   Comercial  → conta para o dono do card.
//   Direto     → não conta: fechou sem passar pelo comercial.
//   Recompra   → não conta: não dá comissão.
//   vazio      → conta só se o negócio passou por negociação em alguma data
//                ou se um vendedor marcou o Ganho com a própria mão (o
//                histórico diz quem clicou). E entra na lista "sem
//                classificação", para o gerente preencher o campo no CRM.
// O campo é preenchido pela automação da venda e, na conferência dos
// ganhos, pelo gerente comercial; a regra automática só cobre o esquecimento.
//
// PERDIDOS: estão em Perdido HOJE, com a data de fechamento do negócio
// dentro do período, e passaram por negociação em alguma data. A data sai do
// mesmo campo que as vendas usam: quando o card vira Perdido, o fluxo grava
// a data de fechamento no mesmo instante em que muda a etapa.
//
// A régua foi para a data de CRIAÇÃO por algumas horas em 21/09/2026 e voltou
// no mesmo dia, por decisão do dono do painel: como quase todo lead decide em
// menos de 48 horas, as duas contas dão quase o mesmo número, e "perdeu neste
// mês" é mais simples de explicar ao time do que "entrou neste mês e morreu".
//
// VENDAS SEM NEGOCIAÇÃO: os ganhos contados cujo lead nunca passou por
// negociação (venda pelo checkout, marcada à mão, ou de qualificação direto
// para Ganho). Saem daqui para o componente juntá-las ao cohort, no lote do
// dia da venda: o lead foi recebido pelo vendedor, só que o registro da
// chegada é a própria venda. Decisão do dono do painel em 17/09/2026.
import { agrupar, deMicros, type Filtro, type Grupo, listarNegocios } from 'src/painel/crm';
import { type Falha, tentar } from 'src/painel/dados';
import {
  feitaPorPessoa,
  filtroDeEntradaEm,
  listarMudancas,
  type MudancaDeEtapa,
  negociosQuePassaramPor,
  SO_NEGOCIOS,
} from 'src/painel/linha-do-tempo';
import { limitesIso, type Periodo, recortarNoHistorico } from 'src/painel/periodo';
import { ETAPAS_EM_NEGOCIACAO } from 'src/painel/rotulos';

export type DesfechoPorVendedor = {
  chave: string | null;
  ganhos: number;
  // Em reais, dos ganhos.
  receita: number;
  ticketMedio: number | null;
  perdidos: number;
};

export type VendaSemClassificacao = {
  id: string;
  // Entrou nos ganhos pela regra automática (negociação ou marcada à mão).
  contada: boolean;
};

export type VendaSemNegociacao = {
  id: string;
  ownerId: string | null;
  closeDate: string;
  valor: number | null;
};

export type Desfechos = {
  porVendedor: DesfechoPorVendedor[];
  semClassificacao: VendaSemClassificacao[];
  vendasSemNegociacao: VendaSemNegociacao[];
  truncado: boolean;
  falhas: Falha[];
};

type Venda = {
  id: string;
  fechamento: string | null;
  ownerId: string | null;
  closeDate: string;
  amount: { amountMicros: number | null } | null;
};

type Perda = { id: string; ownerId: string | null };

const noPeriodo = (campo: string, inicio: string, fim: string): Filtro[] => [
  { [campo]: { gte: inicio } },
  { [campo]: { lt: fim } },
];

export const buscarDesfechos = async (periodo: Periodo): Promise<Desfechos> => {
  // Vendas e perdas são pela data de fechamento do negócio e não dependem do
  // histórico, então usam o período pedido inteiro. Só "quem marcou o Ganho à
  // mão" vem do histórico e obedece ao piso de 01/09/2026.
  const { inicio, fim } = limitesIso(periodo);
  const historico = limitesIso(recortarNoHistorico(periodo).periodo);
  const falhas: Falha[] = [];

  // Quem está em Perdido hoje já entra filtrado pela etapa, então um perdido
  // reaberto some daqui sozinho. As linhas "virou Ganho" entram para saber
  // quem marcou à mão.
  const [vendas, perdas, ganhos] = await Promise.all([
    tentar(
      'vendas do período',
      listarNegocios<Venda>(
        {
          and: [
            { funnel: { eq: 'VENDAS' } },
            { stage: { eq: 'WON' } },
            ...noPeriodo('closeDate', inicio, fim),
          ],
        },
        'id fechamento ownerId closeDate amount { amountMicros }',
      ),
      { nos: [] as Venda[], truncado: false },
      falhas,
    ),
    tentar(
      'perdas do período',
      listarNegocios<Perda>(
        {
          and: [
            { funnel: { eq: 'VENDAS' } },
            { stage: { eq: 'LOST' } },
            ...noPeriodo('closeDate', inicio, fim),
          ],
        },
        'id ownerId',
      ),
      { nos: [] as Perda[], truncado: false },
      falhas,
    ),
    tentar(
      'ganhos marcados à mão',
      listarMudancas({
        and: [
          SO_NEGOCIOS,
          filtroDeEntradaEm(['WON']),
          ...noPeriodo('happensAt', historico.inicio, historico.fim),
        ],
      }),
      { mudancas: [] as MudancaDeEtapa[], truncado: false },
      falhas,
    ),
  ]);

  const idsDePerdas = perdas.nos.map((perda) => perda.id);
  const semCampo = vendas.nos.filter((venda) => venda.fechamento === null);
  const marcadasAMao = new Set(
    ganhos.mudancas
      .filter((mudanca) => feitaPorPessoa(mudanca))
      .map((mudanca) => mudanca.targetOpportunityId),
  );

  // Quem passou por negociação em alguma data: decide as vendas sem campo,
  // as perdas que contam e as vendas que pularam a etapa.
  const passaram = await tentar(
    'histórico de negociação',
    negociosQuePassaramPor(
      [...new Set([...vendas.nos.map((venda) => venda.id), ...idsDePerdas])],
      ETAPAS_EM_NEGOCIACAO,
    ),
    new Set<string>(),
    falhas,
  );

  const semClassificacao = semCampo.map((venda) => ({
    id: venda.id,
    contada: passaram.has(venda.id) || marcadasAMao.has(venda.id),
  }));

  const idsDeGanhos = [
    ...vendas.nos.filter((venda) => venda.fechamento === 'COMERCIAL').map((venda) => venda.id),
    ...semClassificacao.filter((venda) => venda.contada).map((venda) => venda.id),
  ];

  const contadas = new Set(idsDeGanhos);
  const vendasSemNegociacao = vendas.nos
    .filter((venda) => contadas.has(venda.id) && !passaram.has(venda.id))
    .map((venda) => ({
      id: venda.id,
      ownerId: venda.ownerId,
      closeDate: venda.closeDate,
      valor: deMicros(venda.amount?.amountMicros),
    }));

  const porDono = (ids: string[], onde: string, condicoes: Filtro[] = []): Promise<Grupo[]> =>
    ids.length === 0
      ? Promise.resolve([])
      : tentar(
          onde,
          agrupar({ and: [{ id: { in: ids } }, ...condicoes] }, [{ ownerId: true }]),
          [],
          falhas,
        );

  const gruposDeVendas = await porDono(idsDeGanhos, 'vendas por vendedor');

  // Perdas já vêm com o dono, então a contagem é aqui mesmo, sem outra
  // consulta. Só entra quem passou por negociação: lead descartado ainda na
  // qualificação nunca foi trabalhado por um vendedor.
  const perdasPorDono = new Map<string | null, number>();

  for (const perda of perdas.nos) {
    if (!passaram.has(perda.id)) continue;
    perdasPorDono.set(perda.ownerId, (perdasPorDono.get(perda.ownerId) ?? 0) + 1);
  }

  const linhas = new Map<string | null, DesfechoPorVendedor>();
  const linha = (chave: string | null): DesfechoPorVendedor => {
    const existente = linhas.get(chave);

    if (existente !== undefined) return existente;

    const nova = { chave, ganhos: 0, receita: 0, ticketMedio: null, perdidos: 0 };

    linhas.set(chave, nova);

    return nova;
  };

  for (const grupo of gruposDeVendas) {
    const alvo = linha(grupo.chaves[0] ?? null);

    alvo.ganhos = grupo.contagem;
    alvo.receita = grupo.somaReais;
    // Receita ÷ ganhos, e não a média que o CRM devolve: a média do CRM
    // ignora venda sem valor preenchido, e aí a linha da pessoa não batia com
    // a linha Total, que sempre dividiu pela quantidade de vendas.
    alvo.ticketMedio = grupo.contagem === 0 ? null : grupo.somaReais / grupo.contagem;
  }

  for (const [dono, quantidade] of perdasPorDono) {
    linha(dono).perdidos = quantidade;
  }

  return {
    porVendedor: [...linhas.values()],
    semClassificacao,
    vendasSemNegociacao,
    truncado: vendas.truncado || perdas.truncado || ganhos.truncado,
    falhas,
  };
};

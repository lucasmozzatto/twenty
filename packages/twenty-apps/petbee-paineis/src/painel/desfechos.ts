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
// PERDIDOS seguem o funil: viraram Perdido no período, passaram por
// negociação em alguma data e continuam em Perdido hoje.
import { agrupar, type Filtro, type Grupo, listarNegocios } from 'src/painel/crm';
import { type Falha, tentar } from 'src/painel/dados';
import {
  feitaPorPessoa,
  filtroDeEntradaEm,
  listarMudancas,
  type MudancaDeEtapa,
  negociosQueEntraramEm,
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

export type Desfechos = {
  porVendedor: DesfechoPorVendedor[];
  semClassificacao: VendaSemClassificacao[];
  truncado: boolean;
  falhas: Falha[];
};

type Venda = { id: string; fechamento: string | null };

const noPeriodo = (campo: string, inicio: string, fim: string): Filtro[] => [
  { [campo]: { gte: inicio } },
  { [campo]: { lt: fim } },
];

export const buscarDesfechos = async (periodo: Periodo): Promise<Desfechos> => {
  // Vendas são pela data de fechamento do negócio e não dependem do
  // histórico, então usam o período pedido. Perdas e "quem marcou à mão"
  // vêm do histórico e obedecem ao piso de 01/09/2026, como Funil e Cohort.
  const { inicio, fim } = limitesIso(periodo);
  const historico = limitesIso(recortarNoHistorico(periodo).periodo);
  const falhas: Falha[] = [];

  // Venda é pela data de fechamento, igual ao resto do painel. Perda não tem
  // data própria no negócio, então vem do evento "virou Perdido" no histórico.
  // As linhas "virou Ganho" entram para saber quem marcou à mão.
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
        'id fechamento',
      ),
      { nos: [] as Venda[], truncado: false },
      falhas,
    ),
    tentar(
      'perdas do período',
      listarMudancas({
        and: [
          SO_NEGOCIOS,
          filtroDeEntradaEm(['LOST']),
          ...noPeriodo('happensAt', historico.inicio, historico.fim),
        ],
      }),
      { mudancas: [] as MudancaDeEtapa[], truncado: false },
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

  const idsDePerdas = [...negociosQueEntraramEm(perdas.mudancas, ['LOST'])];
  const semCampo = vendas.nos.filter((venda) => venda.fechamento === null);
  const marcadasAMao = new Set(
    ganhos.mudancas
      .filter((mudanca) => feitaPorPessoa(mudanca))
      .map((mudanca) => mudanca.targetOpportunityId),
  );

  // O histórico de negociação só é consultado para quem precisa dele: as
  // perdas e as vendas sem o campo preenchido.
  const passaram = await tentar(
    'histórico de negociação',
    negociosQuePassaramPor(
      [...new Set([...semCampo.map((venda) => venda.id), ...idsDePerdas])],
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

  const porDono = (ids: string[], onde: string, condicoes: Filtro[] = []): Promise<Grupo[]> =>
    ids.length === 0
      ? Promise.resolve([])
      : tentar(
          onde,
          agrupar({ and: [{ id: { in: ids } }, ...condicoes] }, [{ ownerId: true }]),
          [],
          falhas,
        );

  const [gruposDeVendas, gruposDePerdas] = await Promise.all([
    porDono(idsDeGanhos, 'vendas por vendedor'),
    // Só quem CONTINUA em Perdido: um lead perdido e reaberto não é perda.
    porDono(
      idsDePerdas.filter((id) => passaram.has(id)),
      'perdas por vendedor que negociaram',
      [{ stage: { eq: 'LOST' } }],
    ),
  ]);

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
    alvo.ticketMedio = grupo.mediaReais;
  }

  for (const grupo of gruposDePerdas) {
    linha(grupo.chaves[0] ?? null).perdidos = grupo.contagem;
  }

  return {
    porVendedor: [...linhas.values()],
    semClassificacao,
    truncado: vendas.truncado || perdas.truncado || ganhos.truncado,
    falhas,
  };
};

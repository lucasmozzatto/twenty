// Leitura da linha do tempo dos negócios: uma linha por mudança, com a etapa
// de antes e a de depois em JSON. É daqui que sai tudo que "passou por".
import { consultar, type Filtro } from 'src/painel/crm';

// 200 é o teto do servidor por consulta (QUERY_MAX_RECORDS). O teto de páginas
// evita pendurar a tela num intervalo gigante: hoje são ~900 mudanças por mês,
// então 40 páginas dão folga para uns três anos.
const POR_PAGINA = 200;
const MAXIMO_DE_PAGINAS = 40;

export type MudancaDeEtapa = {
  targetOpportunityId: string | null;
  happensAt: string;
  properties: { diff?: { stage?: { after?: string; before?: string } } } | null;
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
      edges { node { targetOpportunityId happensAt properties } }
    }
  }
`;

export const listarMudancas = async (
  filter: Filtro,
): Promise<{ mudancas: MudancaDeEtapa[]; truncado: boolean }> => {
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

  // Compara o que foi lido com o que existe. Um `false` fixo aqui já deixou
  // uma leitura pela metade passar como completa.
  return { mudancas, truncado: mudancas.length < total };
};

// O JSON vira texto na busca, e é assim que ele sai: `"after": "WON"`, com
// espaço depois dos dois-pontos. Sem o espaço o `like` não casa.
export const filtroDeEntradaEm = (etapas: readonly string[]): Filtro => ({
  or: etapas.map((etapa) => ({
    properties: { like: `%"after": "${etapa}"%` },
  })),
});

export const SO_NEGOCIOS: Filtro = { targetOpportunityId: { is: 'NOT_NULL' } };

// Uma linha do histórico é entrada de verdade na etapa só se a etapa mudou.
// Existe linha com "de Ganho para Ganho": alguém editou outro campo e o CRM
// gravou a etapa junto. Em setembro/2026 foi 1 em 36 "ganhos"; sem esta
// checagem ela contaria como venda nova.
export const entrouEm = (
  mudanca: MudancaDeEtapa,
  etapas: readonly string[],
): boolean => {
  const etapa = mudanca.properties?.diff?.stage;

  return (
    etapa?.after !== undefined &&
    etapa.after !== etapa.before &&
    etapas.includes(etapa.after)
  );
};

// Negócios DISTINTOS que entraram nestas etapas. Distinto importa: um negócio
// pode voltar para negociação depois de um Break, e contar duas vezes inflaria
// o funil.
export const negociosQueEntraramEm = (
  mudancas: MudancaDeEtapa[],
  etapas: readonly string[],
): Set<string> => {
  const negocios = new Set<string>();

  for (const mudanca of mudancas) {
    if (entrouEm(mudanca, etapas) && mudanca.targetOpportunityId !== null) {
      negocios.add(mudanca.targetOpportunityId);
    }
  }

  return negocios;
};

// Quais destes negócios passaram por alguma destas etapas em QUALQUER data,
// ou só nas datas que `condicoes` limitar. Em lotes, para a lista de
// identificadores não crescer sem limite numa consulta só.
export const negociosQuePassaramPor = async (
  negocios: string[],
  etapas: readonly string[],
  condicoes: Filtro[] = [],
): Promise<Set<string>> => {
  const passaram = new Set<string>();
  const TAMANHO_DO_LOTE = 150;

  for (let inicio = 0; inicio < negocios.length; inicio += TAMANHO_DO_LOTE) {
    const lote = negocios.slice(inicio, inicio + TAMANHO_DO_LOTE);
    const { mudancas } = await listarMudancas({
      and: [
        { targetOpportunityId: { in: lote } },
        filtroDeEntradaEm(etapas),
        ...condicoes,
      ],
    });

    for (const id of negociosQueEntraramEm(mudancas, etapas)) passaram.add(id);
  }

  return passaram;
};

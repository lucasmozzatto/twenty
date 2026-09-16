// Acesso ao GraphQL do CRM de dentro do componente. O runtime injeta
// TWENTY_API_URL e o token do app; o papel do app é somente leitura, então
// nada aqui consegue alterar um negócio nem por bug.

export type Filtro = Record<string, unknown>;

export const consultar = async <TDados,>(
  query: string,
  variables: Record<string, unknown>,
): Promise<TDados> => {
  const resposta = await fetch(`${process.env.TWENTY_API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.TWENTY_APP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const corpo = (await resposta.json()) as {
    data?: TDados;
    errors?: { message: string }[];
  };

  if (corpo.errors?.length) throw new Error(corpo.errors[0].message);
  if (!corpo.data) throw new Error(`HTTP ${resposta.status}`);

  return corpo.data;
};

export const deMicros = (micros: number | null | undefined): number | null =>
  micros === null || micros === undefined ? null : micros / 1_000_000;

export type Agregados = {
  totalCount: number;
  sumAmountAmountMicros?: number | null;
  avgAmountAmountMicros?: number | null;
};

// O servidor recusa o mesmo campo raiz duas vezes na mesma consulta, mesmo com
// apelidos ("Duplicate root resolver"), então cada filtro é uma consulta. Já
// vários agregados no mesmo filtro cabem juntos: o campo raiz aparece uma vez.
export const agregar = async (
  filter: Filtro,
  campos = 'totalCount',
): Promise<Agregados> => {
  const dados = await consultar<{ opportunities: Agregados }>(
    `query Agregar($filter: OpportunityFilterInput) { opportunities(filter: $filter) { ${campos} } }`,
    { filter },
  );

  return dados.opportunities;
};

export type Grupo = {
  // Uma chave por dimensão pedida, na mesma ordem. `null` é o valor vazio.
  chaves: (string | null)[];
  contagem: number;
  somaReais: number;
  // Média do valor, ignorando os sem valor — igual ao "Ticket médio" nativo.
  mediaReais: number | null;
};

export const agrupar = async (
  filter: Filtro,
  groupBy: Record<string, unknown>[],
): Promise<Grupo[]> => {
  const dados = await consultar<{
    opportunitiesGroupBy: {
      groupByDimensionValues: (string | null)[];
      totalCount: number;
      sumAmountAmountMicros: number | null;
      avgAmountAmountMicros: number | null;
    }[];
  }>(
    `query Agrupar($groupBy: [OpportunityGroupByInput!]!, $filter: OpportunityFilterInput) {
      opportunitiesGroupBy(groupBy: $groupBy, filter: $filter) {
        groupByDimensionValues totalCount sumAmountAmountMicros avgAmountAmountMicros
      }
    }`,
    { groupBy, filter },
  );

  return dados.opportunitiesGroupBy.map((grupo) => ({
    chaves: grupo.groupByDimensionValues,
    contagem: grupo.totalCount,
    somaReais: (grupo.sumAmountAmountMicros ?? 0) / 1_000_000,
    mediaReais: deMicros(grupo.avgAmountAmountMicros),
  }));
};

// Lista negócios de 200 em 200 (teto do servidor) por `offset` com ordem fixa,
// e diz se leu tudo comparando com o total. Só os campos pedidos em `campos`.
export const listarNegocios = async <TNo,>(
  filter: Filtro,
  campos: string,
): Promise<{ nos: TNo[]; truncado: boolean }> => {
  const POR_PAGINA = 200;
  const MAXIMO_DE_PAGINAS = 40;
  const nos: TNo[] = [];
  let total = 0;

  for (let pagina = 0; pagina < MAXIMO_DE_PAGINAS; pagina += 1) {
    const dados = await consultar<{
      opportunities: { totalCount: number; edges: { node: TNo }[] };
    }>(
      `query Negocios($filter: OpportunityFilterInput, $offset: Int) {
        opportunities(
          filter: $filter
          first: ${POR_PAGINA}
          offset: $offset
          orderBy: [{ createdAt: AscNullsLast }]
        ) {
          totalCount
          edges { node { ${campos} } }
        }
      }`,
      { filter, offset: nos.length },
    );

    total = dados.opportunities.totalCount;
    for (const borda of dados.opportunities.edges) nos.push(borda.node);

    if (dados.opportunities.edges.length < POR_PAGINA) break;
  }

  return { nos, truncado: nos.length < total };
};

// Vendedor vem como id de membro do workspace; o nome é buscado uma vez só.
export const buscarNomes = async (): Promise<Record<string, string>> => {
  const dados = await consultar<{
    workspaceMembers: {
      edges: { node: { id: string; name: { firstName: string } } }[];
    };
  }>(
    'query Membros { workspaceMembers { edges { node { id name { firstName } } } } }',
    {},
  );

  return Object.fromEntries(
    dados.workspaceMembers.edges.map(({ node }) => [
      node.id,
      node.name.firstName,
    ]),
  );
};


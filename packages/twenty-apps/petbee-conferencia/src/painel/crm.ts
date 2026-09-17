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

// Cada objeto do CRM tem um campo raiz e um tipo de filtro próprios no
// GraphQL. As assinaturas são objeto personalizado; o nome do tipo segue o
// singular ("Assinatura") e o campo raiz, o plural.
export type Colecao = { raiz: string; tipoDeFiltro: string };

export const NEGOCIOS: Colecao = {
  raiz: 'opportunities',
  tipoDeFiltro: 'OpportunityFilterInput',
};

export const ASSINATURAS: Colecao = {
  raiz: 'assinaturas',
  tipoDeFiltro: 'AssinaturaFilterInput',
};

// Lista registros de 200 em 200 (teto do servidor) por `offset` com ordem
// fixa, e diz se leu tudo comparando com o total que o servidor informa.
// Regra herdada do painéis: a paginação por cursor parou na primeira página
// em produção sem avisar; offset conferido contra o total não passa batido.
export const listar = async <TNo,>(
  colecao: Colecao,
  filter: Filtro,
  ordem: string,
  campos: string,
): Promise<{ nos: TNo[]; truncado: boolean }> => {
  const POR_PAGINA = 200;
  const MAXIMO_DE_PAGINAS = 40;
  const nos: TNo[] = [];
  let total = 0;

  for (let pagina = 0; pagina < MAXIMO_DE_PAGINAS; pagina += 1) {
    const dados = await consultar<
      Record<string, { totalCount: number; edges: { node: TNo }[] }>
    >(
      `query Lista($filter: ${colecao.tipoDeFiltro}, $offset: Int) {
        ${colecao.raiz}(
          filter: $filter
          first: ${POR_PAGINA}
          offset: $offset
          orderBy: [${ordem}]
        ) {
          totalCount
          edges { node { ${campos} } }
        }
      }`,
      { filter, offset: nos.length },
    );

    const resposta = dados[colecao.raiz];

    total = resposta.totalCount;
    for (const borda of resposta.edges) nos.push(borda.node);

    if (resposta.edges.length < POR_PAGINA) break;
  }

  return { nos, truncado: nos.length < total };
};

export type Membro = {
  id: string;
  nome: string;
  userId: string | null;
  email: string | null;
};

// Vendedor vem como id de membro do workspace; o nome e o e-mail saem de uma
// busca só por sessão. A mesma lista diz quem está olhando, pelo userId que
// o runtime entrega ao componente.
export const buscarMembros = async (): Promise<Membro[]> => {
  const dados = await consultar<{
    workspaceMembers: {
      edges: {
        node: {
          id: string;
          userId: string | null;
          userEmail: string | null;
          name: { firstName: string | null; lastName: string | null };
        };
      }[];
    };
  }>(
    'query Membros { workspaceMembers { edges { node { id userId userEmail name { firstName lastName } } } } }',
    {},
  );

  return dados.workspaceMembers.edges.map(({ node }) => ({
    id: node.id,
    nome:
      [node.name.firstName, node.name.lastName]
        .filter((parte) => typeof parte === 'string' && parte.trim() !== '')
        .join(' ') || 'Sem nome',
    userId: node.userId,
    email: node.userEmail,
  }));
};

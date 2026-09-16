// Quadro com seletor de período: a única forma de ter filtro de data global no
// painel, porque os gráficos nativos só leem o filtro gravado em cada um.
//
// v2: seletor + os seis números + linhas por dia + barras por origem, canal e
// vendedor. Próxima fatia: funil por histórico de etapa.
//
// Busca os dados direto do GraphQL do CRM, como a régua da cadência faz: o
// runtime do componente injeta TWENTY_API_URL e o token do app. O papel do app
// é somente leitura, então este código não consegue alterar nada nem por bug.
import { useCallback, useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useColorScheme } from 'twenty-sdk/front-component';

import { PAINEL_PERIODO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Brasília não tem horário de verão desde 2019, então o deslocamento é fixo.
// Se um dia voltar, este é o único lugar a mexer.
const DESLOCAMENTO_BRASILIA = '-03:00';
const FUSO = 'America/Sao_Paulo';
const INICIO_HISTORICO = '2026-09-01';

// Rótulos copiados dos metadados do workspace em 16/09/2026. Opção nova que
// não estiver aqui aparece com o valor "legível" (CHATGPT → Chatgpt).
const ROTULO_ORIGEM: Record<string, string> = {
  INDICACAO_CLINICA: 'Indicação - Clínica',
  INDICACAO_CLIENTE: 'Indicação - Cliente',
  GOOGLE_ADS: 'Google Ads',
  FACEBOOK_ADS: 'Facebook Ads',
  INSTAGRAM_ADS: 'Instagram Ads',
  CLIENTE: 'Cliente',
  CADASTRO_DIRETO: 'Cadastro Direto',
  INFLUENCER: 'Influencer',
  CORRETOR: 'Corretor',
  ROLETA_DA_SORTE: 'Roleta da Sorte',
  ORGANIC_SEARCH: 'Organic Search',
  ORGANIC_SOCIAL: 'Organic Social',
  TOUR: 'Tour',
  PARCEIROS: 'Parceiros',
  FUP_AUTO: 'FUP_auto',
  OUTROS: 'Outros',
  PV: 'PV',
  CHATGPT: 'ChatGPT',
};

const ROTULO_CANAL: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  WHATSAPP_CLIENTES: 'WhatsApp Clientes',
  ONBOARDING: 'Onboarding',
  INDICACAO: 'Indicação',
  FORMULARIO: 'Formulário',
  INSTAGRAM: 'Instagram',
  OUTBOUND: 'Outbound',
  OUTROS: 'Outros',
};

const legivel = (valor: string): string =>
  valor.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (letra) => letra.toUpperCase());

type Predefinido =
  | 'este-mes'
  | 'mes-passado'
  | 'ultimos-7'
  | 'ultimos-30'
  | 'desde-inicio'
  | 'personalizado';

type Periodo = { de: string; ate: string };

// --- Datas (tudo em texto AAAA-MM-DD, sem objeto Date com fuso local) --------

const hojeEmBrasilia = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const somarDias = (dia: string, quantidade: number): string => {
  const [ano, mes, diaDoMes] = dia.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, diaDoMes + quantidade));

  return data.toISOString().slice(0, 10);
};

const primeiroDiaDoMes = (dia: string): string => `${dia.slice(0, 7)}-01`;

const periodoPredefinido = (qual: Predefinido, hoje: string): Periodo => {
  switch (qual) {
    case 'este-mes':
      return { de: primeiroDiaDoMes(hoje), ate: hoje };
    case 'mes-passado': {
      const ultimoDiaMesPassado = somarDias(primeiroDiaDoMes(hoje), -1);

      return {
        de: primeiroDiaDoMes(ultimoDiaMesPassado),
        ate: ultimoDiaMesPassado,
      };
    }
    case 'ultimos-7':
      return { de: somarDias(hoje, -6), ate: hoje };
    case 'ultimos-30':
      return { de: somarDias(hoje, -29), ate: hoje };
    case 'desde-inicio':
      return { de: INICIO_HISTORICO, ate: hoje };
    case 'personalizado':
      return { de: primeiroDiaDoMes(hoje), ate: hoje };
  }
};

// Intervalo fechado em dias vira [início do primeiro dia, início do dia
// seguinte ao último), no horário de Brasília. É o mesmo corte que os
// gráficos nativos usam.
const limitesIso = ({ de, ate }: Periodo) => ({
  inicio: new Date(`${de}T00:00:00${DESLOCAMENTO_BRASILIA}`).toISOString(),
  fim: new Date(
    `${somarDias(ate, 1)}T00:00:00${DESLOCAMENTO_BRASILIA}`,
  ).toISOString(),
});

const formatarDia = (dia: string): string => {
  const [ano, mes, diaDoMes] = dia.split('-');

  return `${diaDoMes}/${mes}/${ano}`;
};

const contarDias = ({ de, ate }: Periodo): number => {
  const [anoDe, mesDe, diaDe] = de.split('-').map(Number);
  const [anoAte, mesAte, diaAte] = ate.split('-').map(Number);
  const milissegundosPorDia = 86_400_000;

  return (
    Math.round(
      (Date.UTC(anoAte, mesAte - 1, diaAte) - Date.UTC(anoDe, mesDe - 1, diaDe)) /
        milissegundosPorDia,
    ) + 1
  );
};

// Um ano é o teto: acima disso a linha por dia vira ruído e o SVG fica pesado.
const listarDias = (periodo: Periodo): string[] => {
  const total = Math.min(contarDias(periodo), 366);

  return Array.from({ length: total }, (_, indice) => somarDias(periodo.de, indice));
};

// --- Dados -------------------------------------------------------------------

type Filtro = Record<string, unknown>;

// O servidor recusa o mesmo campo raiz duas vezes na mesma consulta, mesmo com
// apelidos ("Duplicate root resolver"). Então é uma consulta por filtro, todas
// disparadas ao mesmo tempo. Dentro de uma consulta pode pedir vários
// agregados (contagem, soma, média), porque o campo raiz aparece uma vez só.
const consultar = async <TDados,>(
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

type Agregados = {
  totalCount: number;
  sumAmountAmountMicros?: number | null;
  avgAmountAmountMicros?: number | null;
};

const agregar = async (filter: Filtro, campos = 'totalCount'): Promise<Agregados> => {
  const dados = await consultar<{ opportunities: Agregados }>(
    `query Agregar($filter: OpportunityFilterInput) { opportunities(filter: $filter) { ${campos} } }`,
    { filter },
  );

  return dados.opportunities;
};

type Grupo = { chave: string | null; contagem: number; somaReais: number };

const agrupar = async (filter: Filtro, groupBy: Record<string, unknown>): Promise<Grupo[]> => {
  const dados = await consultar<{
    opportunitiesGroupBy: {
      groupByDimensionValues: (string | null)[];
      totalCount: number;
      sumAmountAmountMicros: number | null;
    }[];
  }>(
    `query Agrupar($groupBy: [OpportunityGroupByInput!]!, $filter: OpportunityFilterInput) {
      opportunitiesGroupBy(groupBy: $groupBy, filter: $filter) {
        groupByDimensionValues totalCount sumAmountAmountMicros
      }
    }`,
    { groupBy: [groupBy], filter },
  );

  return dados.opportunitiesGroupBy.map((grupo) => ({
    chave: grupo.groupByDimensionValues[0] ?? null,
    contagem: grupo.totalCount,
    somaReais: (grupo.sumAmountAmountMicros ?? 0) / 1_000_000,
  }));
};

// Vendedor vem como id de membro do workspace; o nome é buscado uma vez só.
const buscarNomes = async (): Promise<Record<string, string>> => {
  const dados = await consultar<{
    workspaceMembers: { edges: { node: { id: string; name: { firstName: string } } }[] };
  }>('query Membros { workspaceMembers { edges { node { id name { firstName } } } } }', {});

  return Object.fromEntries(
    dados.workspaceMembers.edges.map(({ node }) => [node.id, node.name.firstName]),
  );
};

const deMicros = (micros: number | null | undefined): number | null =>
  micros === null || micros === undefined ? null : micros / 1_000_000;

type Numeros = {
  criados: number;
  vendas: number;
  // Em reais, já convertido de micros.
  receita: number;
  ticketMedio: number | null;
  // Ganhos dentro da própria safra: negócios criados no período que viraram
  // Ganho, sobre os criados no período. É a mesma conta do quadro nativo.
  ganhosDaSafra: number;
  semOrigem: number;
};

type Dados = {
  numeros: Numeros;
  negociosPorOrigem: Grupo[];
  vendasPorOrigem: Grupo[];
  negociosPorCanal: Grupo[];
  vendasPorCanal: Grupo[];
  vendasPorVendedor: Grupo[];
  criadosPorDia: Grupo[];
  vendasPorDia: Grupo[];
};

const buscarDados = async (periodo: Periodo): Promise<Dados> => {
  const { inicio, fim } = limitesIso(periodo);
  const funilVendas = { funnel: { eq: 'VENDAS' } };
  const ganho = { stage: { eq: 'WON' } };

  // Lead conta pela data de criação; venda, pela de fechamento.
  const criadoNoPeriodo = [
    funilVendas,
    { createdAt: { gte: inicio } },
    { createdAt: { lt: fim } },
  ];
  const filtroLead: Filtro = { and: criadoNoPeriodo };
  const filtroVenda: Filtro = {
    and: [funilVendas, ganho, { closeDate: { gte: inicio } }, { closeDate: { lt: fim } }],
  };
  const filtroGanhosDaSafra: Filtro = { and: [...criadoNoPeriodo, ganho] };

  const porDia = (campo: string) => ({ [campo]: { granularity: 'DAY', timeZone: FUSO } });

  const [
    lead,
    venda,
    ganhosDaSafra,
    negociosPorOrigem,
    vendasPorOrigem,
    negociosPorCanal,
    vendasPorCanal,
    vendasPorVendedor,
    criadosPorDia,
    vendasPorDia,
  ] = await Promise.all([
    agregar(filtroLead),
    agregar(filtroVenda, 'totalCount sumAmountAmountMicros avgAmountAmountMicros'),
    agregar(filtroGanhosDaSafra),
    agrupar(filtroLead, { origem: true }),
    agrupar(filtroVenda, { origem: true }),
    agrupar(filtroLead, { canal: true }),
    agrupar(filtroVenda, { canal: true }),
    agrupar(filtroVenda, { ownerId: true }),
    agrupar(filtroLead, porDia('createdAt')),
    agrupar(filtroVenda, porDia('closeDate')),
  ]);

  return {
    numeros: {
      criados: lead.totalCount,
      vendas: venda.totalCount,
      receita: deMicros(venda.sumAmountAmountMicros) ?? 0,
      ticketMedio: deMicros(venda.avgAmountAmountMicros),
      ganhosDaSafra: ganhosDaSafra.totalCount,
      // O grupo sem chave é exatamente "origem vazia": não precisa de consulta própria.
      semOrigem: negociosPorOrigem.find((grupo) => grupo.chave === null)?.contagem ?? 0,
    },
    negociosPorOrigem,
    vendasPorOrigem,
    negociosPorCanal,
    vendasPorCanal,
    vendasPorVendedor,
    criadosPorDia,
    vendasPorDia,
  };
};

// --- Formatação ---------------------------------------------------------------

const formatarInteiro = (valor: number): string =>
  new Intl.NumberFormat('pt-BR').format(valor);

const formatarReais = (valor: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

const formatarPercentual = (parte: number, total: number): string =>
  total === 0
    ? '—'
    : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format((parte / total) * 100)}%`;

type Tema = {
  texto: string;
  suave: string;
  borda: string;
  fundo: string;
  destaque: string;
  vermelho: string;
  rosa: string;
  verde: string;
  azul: string;
};

// --- Gráficos -----------------------------------------------------------------

const Cartao = ({ titulo, tema, children }: { titulo: string; tema: Tema; children: React.ReactNode }) => (
  <div
    style={{
      padding: '12px 14px',
      borderRadius: '8px',
      border: `1px solid ${tema.borda}`,
      background: tema.fundo,
      minWidth: 0,
    }}
  >
    <div style={{ fontSize: '12px', fontWeight: 600, color: tema.texto, marginBottom: '10px' }}>{titulo}</div>
    {children}
  </div>
);

type Barra = { chave: string | null; valor: number };

const Barras = ({
  titulo,
  barras,
  rotulo,
  cor,
  formatar = formatarInteiro,
  tema,
}: {
  titulo: string;
  barras: Barra[];
  rotulo: (chave: string | null) => string;
  cor: string;
  formatar?: (valor: number) => string;
  tema: Tema;
}) => {
  const ordenadas = [...barras].filter((barra) => barra.valor > 0).sort((a, b) => b.valor - a.valor);
  const maximo = Math.max(...ordenadas.map((barra) => barra.valor), 1);

  return (
    <Cartao titulo={titulo} tema={tema}>
      {ordenadas.length === 0 ? (
        <div style={{ fontSize: '12px', color: tema.suave }}>Nada no período.</div>
      ) : (
        ordenadas.map((barra) => (
          <div
            key={barra.chave ?? '__vazio__'}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '12px' }}
          >
            <div
              style={{
                width: '130px',
                flex: '0 0 130px',
                color: barra.chave === null ? tema.suave : tema.texto,
                fontStyle: barra.chave === null ? 'italic' : 'normal',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {rotulo(barra.chave)}
            </div>
            <div style={{ flex: '1 1 auto', height: '14px', background: tema.destaque, borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${(barra.valor / maximo) * 100}%`, height: '100%', background: cor, borderRadius: '4px' }} />
            </div>
            <div style={{ width: '90px', flex: '0 0 90px', textAlign: 'right', color: tema.texto, fontVariantNumeric: 'tabular-nums' }}>
              {formatar(barra.valor)}
            </div>
          </div>
        ))
      )}
    </Cartao>
  );
};

const Linha = ({
  titulo,
  grupos,
  periodo,
  cor,
  tema,
}: {
  titulo: string;
  grupos: Grupo[];
  periodo: Periodo;
  cor: string;
  tema: Tema;
}) => {
  const dias = listarDias(periodo);
  const porDia = new Map(grupos.map((grupo) => [grupo.chave, grupo.contagem]));
  const valores = dias.map((dia) => porDia.get(dia) ?? 0);
  const total = valores.reduce((soma, valor) => soma + valor, 0);
  const maximo = Math.max(...valores, 1);

  // O gráfico precisa esticar na largura e manter a altura. Um SVG que estica
  // deforma texto e bolinhas, então o SVG desenha só o traço (em percentual,
  // com traço de espessura fixa) e pontos e rótulos são HTML posicionado por
  // cima, que não deforma. Os dias ficam numa fileira de colunas iguais.
  const xPorcento = (indice: number) => ((indice + 0.5) * 100) / dias.length;
  // Sobra em cima para o número e embaixo para o ponto não encostar na linha.
  const yPorcento = (valor: number) => 12 + (1 - valor / maximo) * 82;

  const caminho = valores
    .map(
      (valor, indice) =>
        `${indice === 0 ? 'M' : 'L'}${xPorcento(indice).toFixed(2)},${yPorcento(valor).toFixed(2)}`,
    )
    .join(' ');

  // Com muitos dias os rótulos se atropelam: mostra um a cada N.
  const passoRotulo = Math.max(1, Math.ceil(dias.length / 31));
  const mostrarValores = dias.length <= 31;

  return (
    <Cartao titulo={`${titulo} · ${formatarInteiro(total)} no período`} tema={tema}>
      <div style={{ position: 'relative', height: '150px', borderBottom: `1px solid ${tema.borda}` }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
        >
          <path
            d={caminho}
            fill="none"
            stroke={cor}
            strokeWidth="2"
            strokeLinejoin="round"
            style={{ vectorEffect: 'non-scaling-stroke' }}
          />
        </svg>
        {valores.map((valor, indice) => (
          <div key={dias[indice]}>
            <div
              style={{
                position: 'absolute',
                left: `${xPorcento(indice)}%`,
                top: `${yPorcento(valor)}%`,
                width: '7px',
                height: '7px',
                marginLeft: '-3.5px',
                marginTop: '-3.5px',
                borderRadius: '50%',
                background: cor,
              }}
            />
            {mostrarValores && valor > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  left: `${xPorcento(indice)}%`,
                  top: `calc(${yPorcento(valor)}% - 20px)`,
                  transform: 'translateX(-50%)',
                  fontSize: '11px',
                  color: tema.texto,
                  whiteSpace: 'nowrap',
                }}
              >
                {valor}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: '4px' }}>
        {dias.map((dia, indice) => (
          <div key={dia} style={{ flex: '1 1 0', textAlign: 'center', fontSize: '10px', color: tema.suave }}>
            {indice % passoRotulo === 0 ? dia.slice(8, 10) : ''}
          </div>
        ))}
      </div>
    </Cartao>
  );
};

// --- Tela --------------------------------------------------------------------

const PREDEFINIDOS: { valor: Predefinido; rotulo: string }[] = [
  { valor: 'este-mes', rotulo: 'Este mês' },
  { valor: 'mes-passado', rotulo: 'Mês passado' },
  { valor: 'ultimos-7', rotulo: 'Últimos 7 dias' },
  { valor: 'ultimos-30', rotulo: 'Últimos 30 dias' },
  { valor: 'desde-inicio', rotulo: 'Desde 01/09' },
];

const PainelPeriodo = () => {
  const escuro = useColorScheme() === 'dark';
  const hoje = hojeEmBrasilia();

  const [predefinido, setPredefinido] = useState<Predefinido>('este-mes');
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoPredefinido('este-mes', hoje));
  const [dados, setDados] = useState<Dados | null>(null);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const tema: Tema = {
    texto: escuro ? '#ebebeb' : '#333',
    suave: escuro ? '#a0a0a0' : '#777',
    borda: escuro ? '#3a3a3a' : '#e5e5e5',
    fundo: escuro ? '#1d1d1d' : '#fafafa',
    destaque: escuro ? '#2e2e2e' : '#ececec',
    vermelho: '#e05252',
    rosa: '#c2417b',
    verde: '#3f7a4f',
    azul: '#3b6fb6',
  };

  const periodoInvalido = periodo.de > periodo.ate;

  const recarregar = useCallback(async () => {
    if (periodoInvalido) return;
    setCarregando(true);
    setErro(null);
    try {
      setDados(await buscarDados(periodo));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setCarregando(false);
    }
  }, [periodo, periodoInvalido]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  useEffect(() => {
    buscarNomes()
      .then(setNomes)
      .catch(() => setNomes({}));
  }, []);

  const escolherPredefinido = (qual: Predefinido) => {
    setPredefinido(qual);
    setPeriodo(periodoPredefinido(qual, hoje));
  };

  const editarData = (campo: keyof Periodo, valor: string) => {
    if (valor === '') return;
    setPredefinido('personalizado');
    setPeriodo((atual) => ({ ...atual, [campo]: valor }));
  };

  const botaoPeriodo = (valor: Predefinido, rotulo: string) => {
    const ativo = predefinido === valor;

    return (
      <button
        key={valor}
        onClick={() => escolherPredefinido(valor)}
        style={{
          padding: '5px 10px',
          borderRadius: '6px',
          border: `1px solid ${ativo ? tema.texto : tema.borda}`,
          background: ativo ? tema.destaque : 'transparent',
          color: tema.texto,
          fontWeight: ativo ? 700 : 500,
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        {rotulo}
      </button>
    );
  };

  const campoData = (campo: keyof Periodo, rotulo: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: tema.suave }}>
      {rotulo}
      <input
        type="date"
        value={periodo[campo]}
        max={hoje}
        onChange={(evento) => editarData(campo, evento.target.value)}
        style={{
          padding: '4px 6px',
          borderRadius: '6px',
          border: `1px solid ${tema.borda}`,
          background: tema.fundo,
          color: tema.texto,
          fontSize: '12px',
        }}
      />
    </label>
  );

  const numero = (rotulo: string, valor: string | null, cor: string, nota: string) => (
    <div
      key={rotulo}
      style={{
        flex: '1 1 150px',
        padding: '12px 14px',
        borderRadius: '8px',
        border: `1px solid ${tema.borda}`,
        background: tema.fundo,
      }}
    >
      <div style={{ fontSize: '12px', color: tema.suave, marginBottom: '4px' }}>{rotulo}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: cor, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
        {valor ?? '—'}
      </div>
      <div style={{ fontSize: '11px', color: tema.suave, marginTop: '4px' }}>{nota}</div>
    </div>
  );

  const n = dados?.numeros ?? null;
  const rotuloOrigem = (chave: string | null) =>
    chave === null ? 'Sem origem' : (ROTULO_ORIGEM[chave] ?? legivel(chave));
  const rotuloCanal = (chave: string | null) =>
    chave === null ? 'Sem canal' : (ROTULO_CANAL[chave] ?? legivel(chave));
  const rotuloVendedor = (chave: string | null) =>
    chave === null ? 'Sem dono' : (nomes[chave] ?? 'Membro removido');
  const contagens = (grupos: Grupo[]): Barra[] =>
    grupos.map((grupo) => ({ chave: grupo.chave, valor: grupo.contagem }));
  const somas = (grupos: Grupo[]): Barra[] =>
    grupos.map((grupo) => ({ chave: grupo.chave, valor: grupo.somaReais }));

  return (
    <div style={{ padding: '12px 16px', fontFamily: 'inherit', color: tema.texto, fontSize: '13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {PREDEFINIDOS.map((item) => botaoPeriodo(item.valor, item.rotulo))}
        <span style={{ width: '8px' }} />
        {campoData('de', 'De')}
        {campoData('ate', 'Até')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '12px', color: tema.suave }}>
        {periodoInvalido ? (
          <span style={{ color: tema.vermelho }}>A data inicial está depois da final.</span>
        ) : (
          <span>
            {formatarDia(periodo.de)} a {formatarDia(periodo.ate)} · {contarDias(periodo)}{' '}
            {contarDias(periodo) === 1 ? 'dia' : 'dias'} · horário de Brasília
          </span>
        )}
        <a onClick={recarregar} style={{ marginLeft: 'auto', cursor: 'pointer', color: tema.suave }}>
          {carregando ? 'carregando…' : '↻ atualizar'}
        </a>
      </div>

      {erro ? (
        <div style={{ color: tema.vermelho, fontSize: '12px', marginBottom: '8px' }}>
          Não consegui ler o CRM ({erro}).{' '}
          <a onClick={recarregar} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
            Tentar de novo
          </a>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', opacity: carregando ? 0.6 : 1 }}>
        {numero('Negócios criados', n ? formatarInteiro(n.criados) : null, tema.rosa, 'funil Vendas, pela data de criação')}
        {numero('Vendas', n ? formatarInteiro(n.vendas) : null, tema.verde, 'etapa Ganho, pela data de fechamento')}
        {numero('Receita', n ? formatarReais(n.receita) : null, tema.verde, 'soma do valor das vendas')}
        {numero(
          'Ticket médio',
          n ? (n.ticketMedio === null ? '—' : formatarReais(n.ticketMedio)) : null,
          tema.verde,
          'média do valor por venda',
        )}
        {numero(
          'Conversão',
          n ? formatarPercentual(n.ganhosDaSafra, n.criados) : null,
          tema.texto,
          n ? `${formatarInteiro(n.ganhosDaSafra)} ganhos entre os ${formatarInteiro(n.criados)} criados` : 'ganhos entre os criados no período',
        )}
        {numero('Sem origem', n ? formatarInteiro(n.semOrigem) : null, tema.texto, 'criados no período sem origem preenchida')}
      </div>

      {dados && !periodoInvalido ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', opacity: carregando ? 0.6 : 1 }}>
          {/* As linhas por dia ocupam a largura toda, uma abaixo da outra. */}
          <Linha titulo="Negócios criados por dia" grupos={dados.criadosPorDia} periodo={periodo} cor={tema.rosa} tema={tema} />
          <Linha titulo="Vendas por dia" grupos={dados.vendasPorDia} periodo={periodo} cor={tema.verde} tema={tema} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px' }}>
            <Barras titulo="Negócios por origem" barras={contagens(dados.negociosPorOrigem)} rotulo={rotuloOrigem} cor={tema.rosa} tema={tema} />
            <Barras titulo="Vendas por origem" barras={contagens(dados.vendasPorOrigem)} rotulo={rotuloOrigem} cor={tema.verde} tema={tema} />
            <Barras titulo="Negócios por canal" barras={contagens(dados.negociosPorCanal)} rotulo={rotuloCanal} cor={tema.rosa} tema={tema} />
            <Barras titulo="Vendas por canal" barras={contagens(dados.vendasPorCanal)} rotulo={rotuloCanal} cor={tema.verde} tema={tema} />
            <Barras titulo="Receita por origem" barras={somas(dados.vendasPorOrigem)} rotulo={rotuloOrigem} cor={tema.verde} formatar={formatarReais} tema={tema} />
            <Barras titulo="Vendas por vendedor" barras={contagens(dados.vendasPorVendedor)} rotulo={rotuloVendedor} cor={tema.azul} tema={tema} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: PAINEL_PERIODO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'painel-periodo',
  description:
    'Painel comercial com seletor de período: números, linhas por dia e barras por origem, canal e vendedor.',
  component: PainelPeriodo,
});

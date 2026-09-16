// Quadro com seletor de período: a única forma de ter filtro de data global no
// painel, porque os gráficos nativos só leem o filtro gravado em cada um.
//
// v1: seletor + os seis números da aba Comercial (criados, vendas, receita,
// ticket médio, conversão, sem origem). Versões seguintes acrescentam barras
// e o funil por histórico de etapa.
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

type Predefinido =
  | 'este-mes'
  | 'mes-passado'
  | 'ultimos-7'
  | 'ultimos-30'
  | 'desde-inicio'
  | 'personalizado';

type Periodo = { de: string; ate: string };

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

// --- Dados -------------------------------------------------------------------

// O servidor recusa o mesmo campo raiz duas vezes na mesma consulta, mesmo com
// apelidos ("Duplicate root resolver"). Então é uma consulta por filtro, todas
// disparadas ao mesmo tempo. Dentro de uma consulta pode pedir vários
// agregados (contagem, soma, média), porque o campo raiz aparece uma vez só.
type Filtro = Record<string, unknown>;

type Agregados = {
  totalCount: number;
  sumAmountAmountMicros?: number | null;
  avgAmountAmountMicros?: number | null;
};

const agregar = async (
  filter: Filtro,
  campos = 'totalCount',
): Promise<Agregados> => {
  const resposta = await fetch(`${process.env.TWENTY_API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.TWENTY_APP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      query: `query Agregar($filter: OpportunityFilterInput) { opportunities(filter: $filter) { ${campos} } }`,
      variables: { filter },
    }),
  });

  const corpo = (await resposta.json()) as {
    data?: { opportunities: Agregados };
    errors?: { message: string }[];
  };

  if (corpo.errors?.length) throw new Error(corpo.errors[0].message);
  if (!corpo.data) throw new Error(`HTTP ${resposta.status}`);

  return corpo.data.opportunities;
};

const deMicros = (micros: number | null | undefined): number | null =>
  micros === null || micros === undefined ? null : micros / 1_000_000;

const buscarNumeros = async (periodo: Periodo): Promise<Numeros> => {
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
    and: [
      funilVendas,
      ganho,
      { closeDate: { gte: inicio } },
      { closeDate: { lt: fim } },
    ],
  };
  const filtroGanhosDaSafra: Filtro = { and: [...criadoNoPeriodo, ganho] };
  const filtroSemOrigem: Filtro = {
    and: [...criadoNoPeriodo, { origem: { is: 'NULL' } }],
  };

  const [lead, venda, ganhosDaSafra, semOrigem] = await Promise.all([
    agregar(filtroLead),
    agregar(
      filtroVenda,
      'totalCount sumAmountAmountMicros avgAmountAmountMicros',
    ),
    agregar(filtroGanhosDaSafra),
    agregar(filtroSemOrigem),
  ]);

  return {
    criados: lead.totalCount,
    vendas: venda.totalCount,
    receita: deMicros(venda.sumAmountAmountMicros) ?? 0,
    ticketMedio: deMicros(venda.avgAmountAmountMicros),
    ganhosDaSafra: ganhosDaSafra.totalCount,
    semOrigem: semOrigem.totalCount,
  };
};

// --- Tela --------------------------------------------------------------------

const PREDEFINIDOS: { valor: Predefinido; rotulo: string }[] = [
  { valor: 'este-mes', rotulo: 'Este mês' },
  { valor: 'mes-passado', rotulo: 'Mês passado' },
  { valor: 'ultimos-7', rotulo: 'Últimos 7 dias' },
  { valor: 'ultimos-30', rotulo: 'Últimos 30 dias' },
  { valor: 'desde-inicio', rotulo: 'Desde 01/09' },
];

const formatarInteiro = (valor: number): string =>
  new Intl.NumberFormat('pt-BR').format(valor);

const formatarReais = (valor: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    valor,
  );

const formatarPercentual = (parte: number, total: number): string =>
  total === 0
    ? '—'
    : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format((parte / total) * 100)}%`;

const PainelPeriodo = () => {
  const escuro = useColorScheme() === 'dark';
  const hoje = hojeEmBrasilia();

  const [predefinido, setPredefinido] = useState<Predefinido>('este-mes');
  const [periodo, setPeriodo] = useState<Periodo>(() =>
    periodoPredefinido('este-mes', hoje),
  );
  const [numeros, setNumeros] = useState<Numeros | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const cores = {
    texto: escuro ? '#ebebeb' : '#333',
    suave: escuro ? '#a0a0a0' : '#777',
    borda: escuro ? '#3a3a3a' : '#e5e5e5',
    fundo: escuro ? '#1d1d1d' : '#fafafa',
    destaque: escuro ? '#2a2a2a' : '#eeeeee',
    vermelho: '#e05252',
    rosa: '#c2417b',
    verde: '#3f7a4f',
  };

  const periodoInvalido = periodo.de > periodo.ate;

  const recarregar = useCallback(async () => {
    if (periodoInvalido) return;
    setCarregando(true);
    setErro(null);
    try {
      setNumeros(await buscarNumeros(periodo));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setCarregando(false);
    }
  }, [periodo, periodoInvalido]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

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
          border: `1px solid ${ativo ? cores.texto : cores.borda}`,
          background: ativo ? cores.destaque : 'transparent',
          color: cores.texto,
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
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px',
        color: cores.suave,
      }}
    >
      {rotulo}
      <input
        type="date"
        value={periodo[campo]}
        max={hoje}
        onChange={(evento) => editarData(campo, evento.target.value)}
        style={{
          padding: '4px 6px',
          borderRadius: '6px',
          border: `1px solid ${cores.borda}`,
          background: cores.fundo,
          color: cores.texto,
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
        border: `1px solid ${cores.borda}`,
        background: cores.fundo,
      }}
    >
      <div style={{ fontSize: '12px', color: cores.suave, marginBottom: '4px' }}>{rotulo}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: cor, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
        {valor ?? '—'}
      </div>
      <div style={{ fontSize: '11px', color: cores.suave, marginTop: '4px' }}>{nota}</div>
    </div>
  );

  const n = numeros;

  return (
    <div style={{ padding: '12px 16px', fontFamily: 'inherit', color: cores.texto, fontSize: '13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {PREDEFINIDOS.map((item) => botaoPeriodo(item.valor, item.rotulo))}
        <span style={{ width: '8px' }} />
        {campoData('de', 'De')}
        {campoData('ate', 'Até')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '12px', color: cores.suave }}>
        {periodoInvalido ? (
          <span style={{ color: cores.vermelho }}>A data inicial está depois da final.</span>
        ) : (
          <span>
            {formatarDia(periodo.de)} a {formatarDia(periodo.ate)} · {contarDias(periodo)}{' '}
            {contarDias(periodo) === 1 ? 'dia' : 'dias'} · horário de Brasília
          </span>
        )}
        <a onClick={recarregar} style={{ marginLeft: 'auto', cursor: 'pointer', color: cores.suave }}>
          {carregando ? 'carregando…' : '↻ atualizar'}
        </a>
      </div>

      {erro ? (
        <div style={{ color: cores.vermelho, fontSize: '12px', marginBottom: '8px' }}>
          Não consegui ler o CRM ({erro}).{' '}
          <a onClick={recarregar} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
            Tentar de novo
          </a>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {numero('Negócios criados', n ? formatarInteiro(n.criados) : null, cores.rosa, 'funil Vendas, pela data de criação')}
        {numero('Vendas', n ? formatarInteiro(n.vendas) : null, cores.verde, 'etapa Ganho, pela data de fechamento')}
        {numero('Receita', n ? formatarReais(n.receita) : null, cores.verde, 'soma do valor das vendas')}
        {numero(
          'Ticket médio',
          n ? (n.ticketMedio === null ? '—' : formatarReais(n.ticketMedio)) : null,
          cores.verde,
          'média do valor por venda',
        )}
        {numero(
          'Conversão',
          n ? formatarPercentual(n.ganhosDaSafra, n.criados) : null,
          cores.texto,
          n ? `${formatarInteiro(n.ganhosDaSafra)} ganhos entre os ${formatarInteiro(n.criados)} criados` : 'ganhos entre os criados no período',
        )}
        {numero('Sem origem', n ? formatarInteiro(n.semOrigem) : null, cores.texto, 'criados no período sem origem preenchida')}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: PAINEL_PERIODO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'painel-periodo',
  description:
    'Painel comercial com seletor de período (v0: negócios criados e vendas).',
  component: PainelPeriodo,
});

// As perguntas que o quadro faz ao CRM, todas de uma vez.
//
// As três regras de filtro, iguais às da aba Comercial:
//   LEAD     → funil Vendas + data de CRIAÇÃO no período
//   VENDA    → funil Vendas + etapa Ganho + data de FECHAMENTO no período
//   PIPELINE → funil Vendas + etapa em aberto, SEM data (é foto de agora)
import {
  type Agregados,
  agregar,
  agrupar,
  deMicros,
  type Filtro,
  type Grupo,
} from 'src/painel/crm';
import { FUSO, limitesIso, type Periodo } from 'src/painel/periodo';
import {
  ETAPAS_ABERTAS,
  ETAPAS_EM_NEGOCIACAO,
  MOTIVOS_COM_CONVERSA,
} from 'src/painel/rotulos';

export type Numeros = {
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

export type Contagem = { chave: string | null; valor: number };

// Um quadro que falha não derruba a página: guardamos o motivo e seguimos com
// os outros. Sem isto, uma consulta recusada apagava o painel inteiro.
export type Falha = { onde: string; motivo: string };

const tentar = <TDados,>(
  onde: string,
  promessa: Promise<TDados>,
  padrao: TDados,
  falhas: Falha[],
): Promise<TDados> =>
  promessa.catch((erro: unknown) => {
    falhas.push({
      onde,
      motivo: erro instanceof Error ? erro.message : String(erro),
    });

    return padrao;
  });

export type Pipeline = {
  aberto: number;
  semDono: number;
  emNegociacao: number;
  porDono: Contagem[];
  // Uma entrada por etapa em aberto, na ordem do funil.
  porEtapaEDono: { etapa: string; pedacos: Contagem[] }[];
  // Os donos que aparecem no pipeline, para a legenda e as cores.
  donos: (string | null)[];
};

export type Dados = {
  numeros: Numeros;
  negociosPorOrigem: Grupo[];
  vendasPorOrigem: Grupo[];
  negociosPorCanal: Grupo[];
  vendasPorCanal: Grupo[];
  vendasPorVendedor: Grupo[];
  criadosPorDia: Grupo[];
  vendasPorDia: Grupo[];
  pipeline: Pipeline;
  motivosPerda: Grupo[];
  perdasComConversa: number;
  falhas: Falha[];
};

const somar = (grupos: Grupo[]): number =>
  grupos.reduce((total, grupo) => total + grupo.contagem, 0);

const montarPipeline = (grupos: Grupo[]): Pipeline => {
  const porDono = new Map<string | null, number>();

  for (const grupo of grupos) {
    const dono = grupo.chaves[1] ?? null;

    porDono.set(dono, (porDono.get(dono) ?? 0) + grupo.contagem);
  }

  // Maior pipeline primeiro; "Sem dono" sempre no fim, porque não é pessoa.
  const donos = [...porDono.entries()]
    .sort(([chaveA, valorA], [chaveB, valorB]) => {
      if (chaveA === null) return 1;
      if (chaveB === null) return -1;

      return valorB - valorA;
    })
    .map(([chave]) => chave);

  return {
    aberto: somar(grupos),
    semDono: porDono.get(null) ?? 0,
    emNegociacao: somar(
      grupos.filter((grupo) => ETAPAS_EM_NEGOCIACAO.includes(grupo.chaves[0] ?? '')),
    ),
    porDono: donos.map((dono) => ({ chave: dono, valor: porDono.get(dono) ?? 0 })),
    porEtapaEDono: ETAPAS_ABERTAS.map((etapa) => ({
      etapa,
      pedacos: donos.map((dono) => ({
        chave: dono,
        valor: somar(
          grupos.filter(
            (grupo) => grupo.chaves[0] === etapa && (grupo.chaves[1] ?? null) === dono,
          ),
        ),
      })),
    })),
    donos,
  };
};

export const buscarDados = async (periodo: Periodo): Promise<Dados> => {
  const { inicio, fim } = limitesIso(periodo);
  const funilVendas = { funnel: { eq: 'VENDAS' } };
  const ganho = { stage: { eq: 'WON' } };

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
  // Sem data de propósito: pipeline é o que está na mesa agora.
  const filtroPipeline: Filtro = {
    and: [funilVendas, { stage: { in: [...ETAPAS_ABERTAS] } }],
  };
  const filtroPerdas: Filtro = {
    and: [...criadoNoPeriodo, { stage: { eq: 'LOST' } }],
  };

  const porDia = (campo: string) => ({
    [campo]: { granularity: 'DAY', timeZone: FUSO },
  });

  const falhas: Falha[] = [];
  const semGrupos: Grupo[] = [];
  const semAgregado: Agregados = { totalCount: 0 };

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
    pipelineBruto,
    motivosPerda,
  ] = await Promise.all([
    tentar('negócios criados', agregar(filtroLead), semAgregado, falhas),
    tentar(
      'vendas, receita e ticket',
      agregar(filtroVenda, 'totalCount sumAmountAmountMicros avgAmountAmountMicros'),
      semAgregado,
      falhas,
    ),
    tentar('conversão', agregar(filtroGanhosDaSafra), semAgregado, falhas),
    tentar('negócios por origem', agrupar(filtroLead, [{ origem: true }]), semGrupos, falhas),
    tentar('vendas por origem', agrupar(filtroVenda, [{ origem: true }]), semGrupos, falhas),
    tentar('negócios por canal', agrupar(filtroLead, [{ canal: true }]), semGrupos, falhas),
    tentar('vendas por canal', agrupar(filtroVenda, [{ canal: true }]), semGrupos, falhas),
    tentar(
      'vendas por vendedor',
      agrupar(filtroVenda, [{ ownerId: true }]),
      semGrupos,
      falhas,
    ),
    tentar('criados por dia', agrupar(filtroLead, [porDia('createdAt')]), semGrupos, falhas),
    tentar('vendas por dia', agrupar(filtroVenda, [porDia('closeDate')]), semGrupos, falhas),
    tentar(
      'pipeline por etapa e dono',
      agrupar(filtroPipeline, [{ stage: true }, { ownerId: true }]),
      semGrupos,
      falhas,
    ),
    tentar('motivos de perda', agrupar(filtroPerdas, [{ motivoLost: true }]), semGrupos, falhas),
  ]);

  return {
    numeros: {
      criados: lead.totalCount,
      vendas: venda.totalCount,
      receita: deMicros(venda.sumAmountAmountMicros) ?? 0,
      ticketMedio: deMicros(venda.avgAmountAmountMicros),
      ganhosDaSafra: ganhosDaSafra.totalCount,
      // O grupo sem chave é exatamente "origem vazia": não precisa de consulta própria.
      semOrigem:
        negociosPorOrigem.find((grupo) => grupo.chaves[0] === null)?.contagem ?? 0,
    },
    negociosPorOrigem,
    vendasPorOrigem,
    negociosPorCanal,
    vendasPorCanal,
    vendasPorVendedor,
    criadosPorDia,
    vendasPorDia,
    pipeline: montarPipeline(pipelineBruto),
    motivosPerda,
    perdasComConversa: somar(
      motivosPerda.filter((grupo) =>
        MOTIVOS_COM_CONVERSA.includes(grupo.chaves[0] ?? ''),
      ),
    ),
    falhas,
  };
};

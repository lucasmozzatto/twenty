// O período anterior, para o comparativo. Só o que faz sentido comparar:
// pipeline fica fora de propósito, porque é foto de agora e não existe o
// pipeline "de agosto" para colocar do lado.
import {
  type Agregados,
  agregar,
  agrupar,
  deMicros,
  type Grupo,
} from 'src/painel/crm';
import { type Falha, type Numeros, tentar } from 'src/painel/dados';
import { FUSO, limitesIso, type Periodo } from 'src/painel/periodo';
import { MOTIVOS_COM_CONVERSA } from 'src/painel/rotulos';

export type Comparacao = {
  periodo: Periodo;
  numeros: Numeros;
  perdasComConversa: number;
  // As mesmas séries por dia do período de agora, para desenhar por cima.
  criadosPorDia: Grupo[];
  vendasPorDia: Grupo[];
  // Os mesmos agrupamentos das barras, para o "antes" de cada linha.
  negociosPorOrigem: Grupo[];
  vendasPorOrigem: Grupo[];
  negociosPorCanal: Grupo[];
  vendasPorCanal: Grupo[];
  vendasPorVendedor: Grupo[];
  falhas: Falha[];
};

export const buscarComparacao = async (periodo: Periodo): Promise<Comparacao> => {
  const { inicio, fim } = limitesIso(periodo);
  const funilVendas = { funnel: { eq: 'VENDAS' } };
  const ganho = { stage: { eq: 'WON' } };

  const criadoNoPeriodo = [
    funilVendas,
    { createdAt: { gte: inicio } },
    { createdAt: { lt: fim } },
  ];

  const filtroVenda = {
    and: [
      funilVendas,
      ganho,
      { closeDate: { gte: inicio } },
      { closeDate: { lt: fim } },
    ],
  };

  const porDia = (campo: string) => ({
    [campo]: { granularity: 'DAY', timeZone: FUSO },
  });

  const falhas: Falha[] = [];
  const semAgregado: Agregados = { totalCount: 0 };
  const semGrupos: Grupo[] = [];

  const [
    lead,
    venda,
    ganhosDoCohort,
    semOrigem,
    perdasComConversa,
    criadosPorDia,
    vendasPorDia,
    negociosPorOrigem,
    vendasPorOrigem,
    negociosPorCanal,
    vendasPorCanal,
    vendasPorVendedor,
  ] = await Promise.all([
      tentar(
        'comparação de criados',
        agregar({ and: criadoNoPeriodo }),
        semAgregado,
        falhas,
      ),
      tentar(
        'comparação de vendas',
        agregar(
          filtroVenda,
          'totalCount sumAmountAmountMicros avgAmountAmountMicros',
        ),
        semAgregado,
        falhas,
      ),
      tentar(
        'comparação de conversão',
        agregar({ and: [...criadoNoPeriodo, ganho] }),
        semAgregado,
        falhas,
      ),
      tentar(
        'comparação de sem origem',
        agregar({ and: [...criadoNoPeriodo, { origem: { is: 'NULL' } }] }),
        semAgregado,
        falhas,
      ),
      tentar(
        'comparação de perdas com conversa',
        agregar({
          and: [
            ...criadoNoPeriodo,
            { stage: { eq: 'LOST' } },
            { motivoLost: { in: MOTIVOS_COM_CONVERSA } },
          ],
        }),
        semAgregado,
        falhas,
      ),
      tentar(
        'comparação de criados por dia',
        agrupar({ and: criadoNoPeriodo }, [porDia('createdAt')]),
        semGrupos,
        falhas,
      ),
      tentar(
        'comparação de vendas por dia',
        agrupar(filtroVenda, [porDia('closeDate')]),
        semGrupos,
        falhas,
      ),
      tentar(
        'comparação de negócios por origem',
        agrupar({ and: criadoNoPeriodo }, [{ origem: true }]),
        semGrupos,
        falhas,
      ),
      tentar(
        'comparação de vendas por origem',
        agrupar(filtroVenda, [{ origem: true }]),
        semGrupos,
        falhas,
      ),
      tentar(
        'comparação de negócios por canal',
        agrupar({ and: criadoNoPeriodo }, [{ canal: true }]),
        semGrupos,
        falhas,
      ),
      tentar(
        'comparação de vendas por canal',
        agrupar(filtroVenda, [{ canal: true }]),
        semGrupos,
        falhas,
      ),
      tentar(
        'comparação de vendas por vendedor',
        agrupar(filtroVenda, [{ ownerId: true }]),
        semGrupos,
        falhas,
      ),
    ]);

  return {
    periodo,
    numeros: {
      criados: lead.totalCount,
      vendas: venda.totalCount,
      receita: deMicros(venda.sumAmountAmountMicros) ?? 0,
      ticketMedio: deMicros(venda.avgAmountAmountMicros),
      ganhosDoCohort: ganhosDoCohort.totalCount,
      semOrigem: semOrigem.totalCount,
    },
    perdasComConversa: perdasComConversa.totalCount,
    criadosPorDia,
    vendasPorDia,
    negociosPorOrigem,
    vendasPorOrigem,
    negociosPorCanal,
    vendasPorCanal,
    vendasPorVendedor,
    falhas,
  };
};

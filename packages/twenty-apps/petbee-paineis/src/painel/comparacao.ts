// O período anterior, para o comparativo. Só o que faz sentido comparar:
// pipeline fica fora de propósito, porque é foto de agora e não existe o
// pipeline "de agosto" para colocar do lado.
import { type Agregados, agregar, deMicros } from 'src/painel/crm';
import { type Falha, type Numeros, tentar } from 'src/painel/dados';
import { limitesIso, type Periodo } from 'src/painel/periodo';
import { MOTIVOS_COM_CONVERSA } from 'src/painel/rotulos';

export type Comparacao = {
  periodo: Periodo;
  numeros: Numeros;
  perdasComConversa: number;
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

  const falhas: Falha[] = [];
  const semAgregado: Agregados = { totalCount: 0 };

  const [lead, venda, ganhosDaSafra, semOrigem, perdasComConversa] =
    await Promise.all([
      tentar(
        'comparação de criados',
        agregar({ and: criadoNoPeriodo }),
        semAgregado,
        falhas,
      ),
      tentar(
        'comparação de vendas',
        agregar(
          {
            and: [
              funilVendas,
              ganho,
              { closeDate: { gte: inicio } },
              { closeDate: { lt: fim } },
            ],
          },
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
    ]);

  return {
    periodo,
    numeros: {
      criados: lead.totalCount,
      vendas: venda.totalCount,
      receita: deMicros(venda.sumAmountAmountMicros) ?? 0,
      ticketMedio: deMicros(venda.avgAmountAmountMicros),
      ganhosDaSafra: ganhosDaSafra.totalCount,
      semOrigem: semOrigem.totalCount,
    },
    perdasComConversa: perdasComConversa.totalCount,
    falhas,
  };
};

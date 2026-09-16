// Os desfechos do período por vendedor: vendas e perdas que PASSARAM por
// negociação em algum momento, mesmo que tenham entrado lá antes do período.
//
// É diferente da safra do funil de propósito. A safra pergunta "dos que
// entraram em negociação NESTE período, como estão hoje". Aqui a pergunta é
// "o que cada vendedor fechou e perdeu NESTE período, entre os leads que
// passaram pela mão dele". Um lead delegado em agosto e vendido em setembro
// conta em setembro. É o que o dono do painel pediu, com as regras escritas.
import { agrupar, type Grupo, listarNegocios } from 'src/painel/crm';
import { type Falha, tentar } from 'src/painel/dados';
import {
  filtroDeEntradaEm,
  listarMudancas,
  type MudancaDeEtapa,
  negociosQueEntraramEm,
  negociosQuePassaramPor,
  SO_NEGOCIOS,
} from 'src/painel/linha-do-tempo';
import { limitesIso, type Periodo } from 'src/painel/periodo';
import { ETAPAS_EM_NEGOCIACAO } from 'src/painel/rotulos';

export type DesfechoPorVendedor = {
  chave: string | null;
  ganhos: number;
  // Em reais, dos ganhos.
  receita: number;
  ticketMedio: number | null;
  perdidos: number;
};

export type Desfechos = {
  porVendedor: DesfechoPorVendedor[];
  truncado: boolean;
  falhas: Falha[];
};

export const buscarDesfechos = async (periodo: Periodo): Promise<Desfechos> => {
  const { inicio, fim } = limitesIso(periodo);
  const falhas: Falha[] = [];
  const funilVendas = { funnel: { eq: 'VENDAS' } };

  // Venda é pela data de fechamento, igual ao resto do painel. Perda não tem
  // data própria no negócio, então vem do evento "virou Perdido" no histórico.
  const [vendas, perdas] = await Promise.all([
    tentar(
      'vendas do período',
      listarNegocios<{ id: string }>(
        {
          and: [
            funilVendas,
            { stage: { eq: 'WON' } },
            { closeDate: { gte: inicio } },
            { closeDate: { lt: fim } },
          ],
        },
        'id',
      ),
      { nos: [] as { id: string }[], truncado: false },
      falhas,
    ),
    tentar(
      'perdas do período',
      listarMudancas({
        and: [
          SO_NEGOCIOS,
          filtroDeEntradaEm(['LOST']),
          { happensAt: { gte: inicio } },
          { happensAt: { lt: fim } },
        ],
      }),
      { mudancas: [] as MudancaDeEtapa[], truncado: false },
      falhas,
    ),
  ]);

  const idsDeVendas = vendas.nos.map((no) => no.id);
  const idsDePerdas = [...negociosQueEntraramEm(perdas.mudancas, ['LOST'])];

  // Quem, entre vendas e perdas, passou por negociação em qualquer data.
  const passaram = await tentar(
    'histórico de negociação',
    negociosQuePassaramPor(
      [...new Set([...idsDeVendas, ...idsDePerdas])],
      ETAPAS_EM_NEGOCIACAO,
    ),
    new Set<string>(),
    falhas,
  );

  const porDono = (ids: string[], onde: string): Promise<Grupo[]> =>
    ids.length === 0
      ? Promise.resolve([])
      : tentar(onde, agrupar({ id: { in: ids } }, [{ ownerId: true }]), [], falhas);

  const [gruposDeVendas, gruposDePerdas] = await Promise.all([
    porDono(
      idsDeVendas.filter((id) => passaram.has(id)),
      'vendas por vendedor que negociaram',
    ),
    porDono(
      idsDePerdas.filter((id) => passaram.has(id)),
      'perdas por vendedor que negociaram',
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
    truncado: vendas.truncado || perdas.truncado,
    falhas,
  };
};

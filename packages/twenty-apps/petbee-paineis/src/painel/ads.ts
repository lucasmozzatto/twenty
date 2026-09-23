// A visão Ads: de onde vieram os leads e quais deles viraram venda, por
// origem, canal e cada pedaço da UTM. Pedido do dono do painel em 22/09/2026
// para ter leitura rápida de mídia sem sair do CRM.
//
// A régua é a do LEAD: entram os negócios CRIADOS no período, e a venda
// contada é a desses mesmos leads, olhando a etapa de hoje. É o certo para
// julgar campanha, porque a campanha responde pelo lead que trouxe, não por
// uma venda de um lead de três meses atrás. O efeito colateral é o mesmo da
// visão Cohort: lead de ontem ainda não decidiu.
//
// Aqui entram TODAS as vendas, inclusive direta e recompra: quem trouxe o
// lead trouxe, não importa quem fechou.
import { deMicros, listarNegocios } from 'src/painel/crm';
import { type Falha, tentar } from 'src/painel/dados';
import { negociosQuePassaramPor } from 'src/painel/linha-do-tempo';
import { limitesIso, type Periodo } from 'src/painel/periodo';
import { ETAPAS_EM_NEGOCIACAO } from 'src/painel/rotulos';

export const DIMENSOES = [
  'origem',
  'canal',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmContent',
  'utmTerm',
  'testeLp',
] as const;

export type Dimensao = (typeof DIMENSOES)[number];

export type NegocioDeMidia = {
  id: string;
  stage: string;
  origem: string | null;
  canal: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  testeLp: string | null;
  valor: number | null;
  // Passou da qualificação: entrou em negociação ou fechamento em alguma
  // data. Vem do histórico de etapas, que só existe a partir de 18/08/2026.
  qualificado: boolean;
};

export type Ads = {
  negocios: NegocioDeMidia[];
  truncado: boolean;
  falhas: Falha[];
};

type NegocioBruto = Omit<NegocioDeMidia, 'valor' | 'qualificado'> & {
  amount: { amountMicros: number | null } | null;
};

export const buscarAds = async (periodo: Periodo): Promise<Ads> => {
  const { inicio, fim } = limitesIso(periodo);
  const falhas: Falha[] = [];

  const criados = await tentar(
    'negócios do período para a visão Ads',
    listarNegocios<NegocioBruto>(
      {
        and: [
          { funnel: { eq: 'VENDAS' } },
          { createdAt: { gte: inicio } },
          { createdAt: { lt: fim } },
        ],
      },
      'id stage origem canal utmSource utmMedium utmCampaign utmContent utmTerm testeLp amount { amountMicros }',
    ),
    { nos: [] as NegocioBruto[], truncado: false },
    falhas,
  );

  // Quem passou da qualificação. É a pergunta "a campanha traz lead que dá
  // conversa", e ela precisa do histórico: a etapa de hoje não conta a
  // história de um lead que já foi perdido.
  const qualificados = await tentar(
    'leads que entraram em negociação',
    negociosQuePassaramPor(
      criados.nos.map((negocio) => negocio.id),
      ETAPAS_EM_NEGOCIACAO,
    ),
    { passaram: new Set<string>(), truncado: false },
    falhas,
  );

  return {
    negocios: criados.nos.map(({ amount, ...resto }) => ({
      ...resto,
      valor: deMicros(amount?.amountMicros),
      qualificado: qualificados.passaram.has(resto.id),
    })),
    truncado: criados.truncado || qualificados.truncado,
    falhas,
  };
};

export type LinhaDeMidia = {
  chave: string;
  rotulo: string;
  leads: number;
  qualificados: number;
  vendas: number;
  receita: number;
};

// O CRM guarda "google" e "Google" como coisas diferentes, e a UTM às vezes
// chega com espaço nas pontas. A limpeza é só na leitura: o painel nunca
// escreve no CRM.
const limpar = (valor: string | null): string => {
  const texto = (valor ?? '').trim().toLowerCase();

  return texto === '' ? '' : texto;
};

export const agruparPorDimensao = (
  negocios: NegocioDeMidia[],
  dimensao: Dimensao,
  rotularEnum: (dimensao: Dimensao, chave: string) => string,
): LinhaDeMidia[] => {
  const linhas = new Map<string, LinhaDeMidia>();

  for (const negocio of negocios) {
    const chave = limpar(negocio[dimensao]);
    const linha = linhas.get(chave) ?? {
      chave,
      rotulo: chave === '' ? 'Sem valor' : rotularEnum(dimensao, chave),
      leads: 0,
      qualificados: 0,
      vendas: 0,
      receita: 0,
    };

    linha.leads += 1;
    if (negocio.qualificado) linha.qualificados += 1;
    if (negocio.stage === 'WON') {
      linha.vendas += 1;
      linha.receita += negocio.valor ?? 0;
    }

    linhas.set(chave, linha);
  }

  // Mais leads primeiro; "Sem valor" sempre no fim, porque não é uma escolha
  // de mídia, é a ausência dela.
  return [...linhas.values()].sort((a, b) => {
    if (a.chave === '') return 1;
    if (b.chave === '') return -1;

    return b.leads - a.leads || b.vendas - a.vendas;
  });
};

export const somarMidia = (linhas: LinhaDeMidia[]): LinhaDeMidia =>
  linhas.reduce(
    (total, linha) => ({
      ...total,
      leads: total.leads + linha.leads,
      qualificados: total.qualificados + linha.qualificados,
      vendas: total.vendas + linha.vendas,
      receita: total.receita + linha.receita,
    }),
    {
      chave: 'total',
      rotulo: 'Total',
      leads: 0,
      qualificados: 0,
      vendas: 0,
      receita: 0,
    },
  );

// As contas da visão Safra: corta o período em semanas ou meses, põe cada
// negócio na safra em que entrou em negociação e resume cada safra. Sem
// consulta nenhuma aqui: é só aritmética em cima do que `safra.ts` trouxe.
import {
  inicioDaSemana,
  type Periodo,
  primeiroDiaDoMes,
  somarDias,
  ultimoDiaDoMes,
} from 'src/painel/periodo';
import { type NegocioDaSafra } from 'src/painel/safra';

export type Agrupamento = 'semana' | 'mes';

// Quem vai comprar compra em 1 ou 2 dias; quem não vai, a cadência encerra em
// até duas semanas (medido em 17/09/2026: 90% das perdas em 11 dias, máximo
// 17). Depois de 14 dias a safra está madura o bastante para ser julgada.
export const DIAS_PARA_AMADURECER = 14;

// Abaixo disso a taxa é sorte, não desempenho.
export const POUCOS_LEADS = 30;

export type Maturidade = 'em-andamento' | 'amadurecendo' | 'madura';

export type ResumoDaSafra = {
  recebidos: number;
  ganhos: number;
  perdidos: number;
  emAberto: number;
  receita: number;
  ticketMedio: number | null;
  diasAteVender: number | null;
};

export type LinhaSafra = ResumoDaSafra & {
  chave: string;
  rotulo: string;
  inicio: string;
  fim: string;
  // O período escolhido corta a safra no meio e deixou dias de fora.
  parcial: boolean;
  maturidade: Maturidade;
};

type Intervalo = { inicio: string; fim: string };

const MESES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

export const rotuloDaSafra = (
  { inicio, fim }: Intervalo,
  agrupamento: Agrupamento,
): string =>
  agrupamento === 'mes'
    ? `${MESES[Number(inicio.slice(5, 7)) - 1]}/${inicio.slice(0, 4)}`
    : `${inicio.slice(8, 10)} a ${fim.slice(8, 10)}/${fim.slice(5, 7)}`;

// Os intervalos que cobrem o período, inteiros, mesmo que o período comece
// ou termine no meio de um.
export const listarIntervalos = (
  periodo: Periodo,
  agrupamento: Agrupamento,
): Intervalo[] => {
  const intervalos: Intervalo[] = [];
  let inicio =
    agrupamento === 'mes'
      ? primeiroDiaDoMes(periodo.de)
      : inicioDaSemana(periodo.de);

  // Teto de 120 safras: mais de dois anos de semanas, além do histórico.
  while (inicio <= periodo.ate && intervalos.length < 120) {
    const fim =
      agrupamento === 'mes' ? ultimoDiaDoMes(inicio) : somarDias(inicio, 6);

    intervalos.push({ inicio, fim });
    inicio = somarDias(fim, 1);
  }

  return intervalos;
};

const MILISSEGUNDOS_POR_DIA = 86_400_000;

const maturidadeDe = (fim: string, hoje: string): Maturidade => {
  if (fim >= hoje) return 'em-andamento';
  if (somarDias(fim, DIAS_PARA_AMADURECER) <= hoje) return 'madura';

  return 'amadurecendo';
};

export const resumirSafra = (negocios: NegocioDaSafra[]): ResumoDaSafra => {
  const ganhos = negocios.filter((negocio) => negocio.stage === 'WON');
  const perdidos = negocios.filter((negocio) => negocio.stage === 'LOST');
  const comValor = ganhos.filter((negocio) => negocio.valor !== null);
  const receita = comValor.reduce((soma, negocio) => soma + (negocio.valor ?? 0), 0);
  // Dias entre chegar no vendedor e virar venda. Fechamento anterior à
  // entrada é dado sujo (data editada à mão) e fica de fora.
  const dias = ganhos
    .filter((negocio) => negocio.closeDate !== null)
    .map(
      (negocio) =>
        (Date.parse(negocio.closeDate ?? '') - Date.parse(negocio.entrouEm)) /
        MILISSEGUNDOS_POR_DIA,
    )
    .filter((valor) => valor >= 0);

  return {
    recebidos: negocios.length,
    ganhos: ganhos.length,
    perdidos: perdidos.length,
    emAberto: negocios.length - ganhos.length - perdidos.length,
    receita,
    ticketMedio: comValor.length === 0 ? null : receita / comValor.length,
    diasAteVender:
      dias.length === 0
        ? null
        : dias.reduce((soma, valor) => soma + valor, 0) / dias.length,
  };
};

const dentro = (negocio: NegocioDaSafra, { inicio, fim }: Intervalo): boolean =>
  negocio.entrouNoDia >= inicio && negocio.entrouNoDia <= fim;

export const agruparSafras = (
  negocios: NegocioDaSafra[],
  periodo: Periodo,
  agrupamento: Agrupamento,
  hoje: string,
): LinhaSafra[] =>
  listarIntervalos(periodo, agrupamento).map((intervalo) => ({
    chave: intervalo.inicio,
    rotulo: rotuloDaSafra(intervalo, agrupamento),
    ...intervalo,
    // Parcial só quando ficaram dias de fora que já existiram: a semana
    // corrente termina no futuro e isso não é corte, é "em andamento".
    parcial:
      intervalo.inicio < periodo.de ||
      (intervalo.fim > periodo.ate && periodo.ate < hoje),
    ...resumirSafra(negocios.filter((negocio) => dentro(negocio, intervalo))),
    maturidade: maturidadeDe(intervalo.fim, hoje),
  }));

export type Celula = { recebidos: number; ganhos: number };

export type LinhaDaGrade = {
  chave: string | null;
  porSafra: Record<string, Celula>;
  total: Celula;
};

// Uma linha por vendedor, uma célula por safra. "Sem dono" por último.
export const gradePorVendedor = (
  negocios: NegocioDaSafra[],
  safras: LinhaSafra[],
): LinhaDaGrade[] => {
  const linhas = new Map<string | null, LinhaDaGrade>();

  for (const negocio of negocios) {
    const safra = safras.find((candidata) => dentro(negocio, candidata));

    if (safra === undefined) continue;

    const linha = linhas.get(negocio.ownerId) ?? {
      chave: negocio.ownerId,
      porSafra: {},
      total: { recebidos: 0, ganhos: 0 },
    };
    const celula = linha.porSafra[safra.chave] ?? { recebidos: 0, ganhos: 0 };
    const ganhou = negocio.stage === 'WON' ? 1 : 0;

    linha.porSafra[safra.chave] = {
      recebidos: celula.recebidos + 1,
      ganhos: celula.ganhos + ganhou,
    };
    linha.total = {
      recebidos: linha.total.recebidos + 1,
      ganhos: linha.total.ganhos + ganhou,
    };
    linhas.set(negocio.ownerId, linha);
  }

  return [...linhas.values()].sort((a, b) => {
    if (a.chave === null) return 1;
    if (b.chave === null) return -1;

    return b.total.recebidos - a.total.recebidos;
  });
};

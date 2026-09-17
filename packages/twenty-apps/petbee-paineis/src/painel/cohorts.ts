// As contas da visão Cohort: corta o período em semanas ou meses, põe cada
// negócio no cohort em que entrou em negociação e resume cada cohort. Sem
// consulta nenhuma aqui: é só aritmética em cima do que `cohort.ts` trouxe.
import {
  inicioDaSemana,
  type Periodo,
  primeiroDiaDoMes,
  somarDias,
  ultimoDiaDoMes,
} from 'src/painel/periodo';
import { type NegocioDoCohort } from 'src/painel/cohort';

export type Agrupamento = 'semana' | 'mes';

// Quem vai comprar compra em 1 ou 2 dias; quem não vai, a cadência encerra em
// até duas semanas (medido em 17/09/2026: 90% das perdas em 11 dias, máximo
// 17). Depois de 14 dias o cohort está maduro o bastante para ser julgado.
export const DIAS_PARA_AMADURECER = 14;

// Abaixo disso a taxa é sorte, não desempenho.
export const POUCOS_LEADS = 30;

export type Maturidade = 'em-andamento' | 'amadurecendo' | 'maduro';

export type ResumoDoCohort = {
  recebidos: number;
  ganhos: number;
  perdidos: number;
  emAberto: number;
  receita: number;
  ticketMedio: number | null;
  diasAteVender: number | null;
};

export type LinhaCohort = ResumoDoCohort & {
  chave: string;
  rotulo: string;
  inicio: string;
  fim: string;
  // O período escolhido corta o cohort no meio e deixou dias de fora.
  parcial: boolean;
  maturidade: Maturidade;
};

type Intervalo = { inicio: string; fim: string };

const MESES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

const diaEMes = (dia: string): string => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

// "19 a 25/08" dentro do mês; "26/08 a 01/09" quando a semana cruza o mês,
// senão o "26" fica sem mês.
export const rotuloDoCohort = (
  { inicio, fim }: Intervalo,
  agrupamento: Agrupamento,
): string => {
  if (agrupamento === 'mes') {
    return `${MESES[Number(inicio.slice(5, 7)) - 1]}/${inicio.slice(0, 4)}`;
  }

  return inicio.slice(0, 7) === fim.slice(0, 7)
    ? `${inicio.slice(8, 10)} a ${diaEMes(fim)}`
    : `${diaEMes(inicio)} a ${diaEMes(fim)}`;
};

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

  // Teto de 120 cohorts: mais de dois anos de semanas, além do histórico.
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
  if (somarDias(fim, DIAS_PARA_AMADURECER) <= hoje) return 'maduro';

  return 'amadurecendo';
};

export const resumirCohort = (negocios: NegocioDoCohort[]): ResumoDoCohort => {
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

const dentro = (negocio: NegocioDoCohort, { inicio, fim }: Intervalo): boolean =>
  negocio.entrouNoDia >= inicio && negocio.entrouNoDia <= fim;

export const agruparCohorts = (
  negocios: NegocioDoCohort[],
  periodo: Periodo,
  agrupamento: Agrupamento,
  hoje: string,
): LinhaCohort[] =>
  listarIntervalos(periodo, agrupamento).map((intervalo) => ({
    chave: intervalo.inicio,
    rotulo: rotuloDoCohort(intervalo, agrupamento),
    ...intervalo,
    // Parcial só quando ficaram dias de fora que já existiram: a semana
    // corrente termina no futuro e isso não é corte, é "em andamento".
    parcial:
      intervalo.inicio < periodo.de ||
      (intervalo.fim > periodo.ate && periodo.ate < hoje),
    ...resumirCohort(negocios.filter((negocio) => dentro(negocio, intervalo))),
    maturidade: maturidadeDe(intervalo.fim, hoje),
  }));

// Tudo que a grade precisa para mostrar qualquer métrica sem nova consulta.
export type Celula = {
  recebidos: number;
  ganhos: number;
  perdidos: number;
  receita: number;
};

const CELULA_VAZIA: Celula = { recebidos: 0, ganhos: 0, perdidos: 0, receita: 0 };

const somar = (celula: Celula, negocio: NegocioDoCohort): Celula => ({
  recebidos: celula.recebidos + 1,
  ganhos: celula.ganhos + (negocio.stage === 'WON' ? 1 : 0),
  perdidos: celula.perdidos + (negocio.stage === 'LOST' ? 1 : 0),
  receita: celula.receita + (negocio.stage === 'WON' ? (negocio.valor ?? 0) : 0),
});

export type LinhaDaGrade = {
  chave: string | null;
  porCohort: Record<string, Celula>;
  total: Celula;
};

// Uma linha por vendedor, uma célula por cohort. "Sem dono" por último.
export const gradePorVendedor = (
  negocios: NegocioDoCohort[],
  cohorts: LinhaCohort[],
): LinhaDaGrade[] => {
  const linhas = new Map<string | null, LinhaDaGrade>();

  for (const negocio of negocios) {
    const cohort = cohorts.find((candidato) => dentro(negocio, candidato));

    if (cohort === undefined) continue;

    const linha = linhas.get(negocio.ownerId) ?? {
      chave: negocio.ownerId,
      porCohort: {},
      total: CELULA_VAZIA,
    };

    linha.porCohort[cohort.chave] = somar(
      linha.porCohort[cohort.chave] ?? CELULA_VAZIA,
      negocio,
    );
    linha.total = somar(linha.total, negocio);
    linhas.set(negocio.ownerId, linha);
  }

  return [...linhas.values()].sort((a, b) => {
    if (a.chave === null) return 1;
    if (b.chave === null) return -1;

    return b.total.recebidos - a.total.recebidos;
  });
};

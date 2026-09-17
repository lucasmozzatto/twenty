// Contas de data do quadro "Por período". Tudo em texto AAAA-MM-DD: objeto
// Date com fuso local erra o dia de quem está em outro fuso.

// Brasília não tem horário de verão desde 2019, então o deslocamento é fixo.
// Se um dia voltar, este é o único lugar a mexer.
const DESLOCAMENTO_BRASILIA = '-03:00';

export const FUSO = 'America/Sao_Paulo';

export type Periodo = { de: string; ate: string };

// Piso de tudo que lê o histórico de etapas (Funil, Cohort, jornada). O CRM
// grava desde 18/08/2026, mas até o fim de agosto o processo ainda estava
// sendo ajustado depois da migração, e o dono do painel pediu em 17/09/2026
// para contar só a partir daqui. É também o botão "Desde 01/09".
export const INICIO_HISTORICO = '2026-09-01';

export const recortarNoHistorico = (
  periodo: Periodo,
): { periodo: Periodo; cortado: boolean } =>
  periodo.de < INICIO_HISTORICO
    ? { periodo: { de: INICIO_HISTORICO, ate: periodo.ate }, cortado: true }
    : { periodo, cortado: false };

export type Predefinido =
  | 'este-mes'
  | 'mes-passado'
  | 'ultimos-7'
  | 'ultimos-30'
  | '8-semanas'
  | 'desde-inicio'
  | 'personalizado';

export const PREDEFINIDOS: { valor: Predefinido; rotulo: string }[] = [
  { valor: 'este-mes', rotulo: 'Este mês' },
  { valor: 'mes-passado', rotulo: 'Mês passado' },
  { valor: 'ultimos-7', rotulo: 'Últimos 7 dias' },
  { valor: 'ultimos-30', rotulo: 'Últimos 30 dias' },
  { valor: '8-semanas', rotulo: '8 semanas' },
  { valor: 'desde-inicio', rotulo: 'Desde 01/09' },
];

// O dia do calendário em Brasília de um instante qualquer.
export const diaEmBrasilia = (instante: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);

export const hojeEmBrasilia = (): string => diaEmBrasilia(new Date());

export const somarDias = (dia: string, quantidade: number): string => {
  const [ano, mes, diaDoMes] = dia.split('-').map(Number);

  return new Date(Date.UTC(ano, mes - 1, diaDoMes + quantidade))
    .toISOString()
    .slice(0, 10);
};

export const primeiroDiaDoMes = (dia: string): string => `${dia.slice(0, 7)}-01`;

// A semana comercial da Petbee vai de quarta a terça, escolha do dono do
// painel em 17/09/2026. 3 é quarta na contagem do Date (0 = domingo).
const DIA_QUE_ABRE_A_SEMANA = 3;

export const inicioDaSemana = (dia: string): string => {
  const [ano, mes, diaDoMes] = dia.split('-').map(Number);
  const diaDaSemana = new Date(Date.UTC(ano, mes - 1, diaDoMes)).getUTCDay();

  return somarDias(dia, -((diaDaSemana - DIA_QUE_ABRE_A_SEMANA + 7) % 7));
};

// Dia 0 do mês seguinte é o último dia deste mês, e o próprio Date resolve a
// virada de ano.
export const ultimoDiaDoMes = (dia: string): string => {
  const [ano, mes] = dia.split('-').map(Number);

  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
};

const menor = (a: string, b: string): string => (a < b ? a : b);

export const periodoPredefinido = (qual: Predefinido, hoje: string): Periodo => {
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
    // A semana atual mais as sete anteriores, começando numa quarta: é o
    // recorte natural da visão Cohort.
    case '8-semanas':
      return { de: somarDias(inicioDaSemana(hoje), -49), ate: hoje };
    case 'desde-inicio':
      return { de: INICIO_HISTORICO, ate: hoje };
    case 'personalizado':
      return { de: primeiroDiaDoMes(hoje), ate: hoje };
  }
};

// Intervalo fechado em dias vira [início do primeiro dia, início do dia
// seguinte ao último), no horário de Brasília. É o mesmo corte que os
// gráficos nativos usam.
export const limitesIso = ({ de, ate }: Periodo) => ({
  inicio: new Date(`${de}T00:00:00${DESLOCAMENTO_BRASILIA}`).toISOString(),
  fim: new Date(
    `${somarDias(ate, 1)}T00:00:00${DESLOCAMENTO_BRASILIA}`,
  ).toISOString(),
});

export const contarDias = ({ de, ate }: Periodo): number => {
  const [anoDe, mesDe, diaDe] = de.split('-').map(Number);
  const [anoAte, mesAte, diaAte] = ate.split('-').map(Number);
  const milissegundosPorDia = 86_400_000;

  return (
    Math.round(
      (Date.UTC(anoAte, mesAte - 1, diaAte) -
        Date.UTC(anoDe, mesDe - 1, diaDe)) /
        milissegundosPorDia,
    ) + 1
  );
};

// Um ano é o teto: acima disso a linha por dia vira ruído.
export const listarDias = (periodo: Periodo): string[] => {
  const total = Math.min(contarDias(periodo), 366);

  return Array.from({ length: total }, (_, indice) =>
    somarDias(periodo.de, indice),
  );
};

// O período com que comparar. A regra muda por botão, porque "anterior" quer
// dizer coisas diferentes: o mês passado inteiro tem 31 dias, mas comparar 16
// dias de setembro com 31 de agosto daria uma queda falsa de metade. Então
// mês compara trecho com trecho, e o resto compara com o bloco de mesmo
// tamanho imediatamente anterior.
export const periodoAnterior = (
  qual: Predefinido,
  periodo: Periodo,
): Periodo => {
  const dias = contarDias(periodo);

  switch (qual) {
    case 'este-mes': {
      const inicio = primeiroDiaDoMes(somarDias(primeiroDiaDoMes(periodo.de), -1));

      // Mesmo trecho do mês passado, sem passar do fim dele: 01 a 16/08 para
      // 01 a 16/09. Fevereiro é mais curto, daí o corte.
      return {
        de: inicio,
        ate: menor(somarDias(inicio, dias - 1), ultimoDiaDoMes(inicio)),
      };
    }
    case 'mes-passado': {
      const ultimo = somarDias(periodo.de, -1);

      return { de: primeiroDiaDoMes(ultimo), ate: ultimo };
    }
    default:
      return { de: somarDias(periodo.de, -dias), ate: somarDias(periodo.de, -1) };
  }
};

// Contas de data da conferência. Tudo em texto AAAA-MM-DD: objeto Date com
// fuso local erra o dia de quem está em outro fuso.
//
// Cópia enxuta de `petbee-paineis/src/painel/periodo.ts`: sem a regra de
// "período anterior" (a conferência não compara períodos) e com o passo de
// mês em mês, que é o jeito de fechar o bônus de agosto estando em setembro.

// Brasília não tem horário de verão desde 2019, então o deslocamento é fixo.
// Se um dia voltar, este é o único lugar a mexer.
const DESLOCAMENTO_BRASILIA = '-03:00';

export const FUSO = 'America/Sao_Paulo';

export type Predefinido =
  | 'este-mes'
  | 'mes-passado'
  | 'ultimos-7'
  | 'ultimos-30'
  | 'personalizado';

export type Periodo = { de: string; ate: string };

export const PREDEFINIDOS: { valor: Predefinido; rotulo: string }[] = [
  { valor: 'este-mes', rotulo: 'Este mês' },
  { valor: 'mes-passado', rotulo: 'Mês passado' },
  { valor: 'ultimos-7', rotulo: 'Últimos 7 dias' },
  { valor: 'ultimos-30', rotulo: 'Últimos 30 dias' },
];

const diaDeBrasilia = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const hojeEmBrasilia = (): string => diaDeBrasilia.format(new Date());

// Dia de Brasília de um instante ISO: a data de fechamento vem em UTC, e 23h
// de Brasília já é o dia seguinte em UTC.
export const diaEmBrasilia = (instante: string): string =>
  diaDeBrasilia.format(new Date(instante));

export const somarDias = (dia: string, quantidade: number): string => {
  const [ano, mes, diaDoMes] = dia.split('-').map(Number);

  return new Date(Date.UTC(ano, mes - 1, diaDoMes + quantidade))
    .toISOString()
    .slice(0, 10);
};

export const primeiroDiaDoMes = (dia: string): string =>
  `${dia.slice(0, 7)}-01`;

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
    case 'personalizado':
      return { de: primeiroDiaDoMes(hoje), ate: hoje };
  }
};

// O mês vizinho do período mostrado, inteiro, sem passar de hoje: são as
// setas "◀ mês" e "mês ▶" do seletor. Devolve null quando o mês pedido ainda
// não começou.
export const mesVizinho = (
  periodo: Periodo,
  passo: -1 | 1,
  hoje: string,
): Periodo | null => {
  const [ano, mes] = periodo.de.split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1 + passo, 1))
    .toISOString()
    .slice(0, 10);

  if (inicio > hoje) return null;

  return { de: inicio, ate: menor(ultimoDiaDoMes(inicio), hoje) };
};

// Depois de navegar com as setas, o botão certo acende de volta se o período
// bater exatamente com ele; senão fica em "personalizado".
export const reconhecerPredefinido = (
  periodo: Periodo,
  hoje: string,
): Predefinido => {
  for (const item of PREDEFINIDOS) {
    const candidato = periodoPredefinido(item.valor, hoje);

    if (candidato.de === periodo.de && candidato.ate === periodo.ate) {
      return item.valor;
    }
  }

  return 'personalizado';
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

// "Setembro de 2026", para o cabeçalho quando o período é um mês do
// calendário: é como o time fala do bônus.
export const rotuloDoMes = (dia: string): string => {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dia}T00:00:00Z`));

  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Formatação em português do Brasil, num lugar só.

export const formatarInteiro = (valor: number): string =>
  new Intl.NumberFormat('pt-BR').format(valor);

export const formatarReais = (valor: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);

export const formatarPercentual = (parte: number, total: number): string =>
  total === 0
    ? '—'
    : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(
        (parte / total) * 100,
      )}%`;

export const formatarDia = (dia: string): string => {
  const [ano, mes, diaDoMes] = dia.split('-');

  return `${diaDoMes}/${mes}/${ano}`;
};

// Variação entre dois períodos, já com o sinal. Sinal mais cor: quem não
// distingue verde de vermelho ainda lê se subiu ou caiu.
export const formatarVariacao = (fracao: number): string => {
  const porcento = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: fracao > -0.1 && fracao < 0.1 ? 1 : 0,
  }).format(Math.abs(fracao) * 100);

  if (fracao > 0) return `+${porcento}%`;
  if (fracao < 0) return `−${porcento}%`;

  return 'igual';
};

// Divisão que não explode quando não havia nada antes: de 0 para 5 não é
// "aumento de infinito por cento", é só "antes 0".
export const variacao = (agora: number, antes: number): number | null =>
  antes === 0 ? null : (agora - antes) / antes;

// Diferença entre duas taxas, em pontos percentuais. Conversão de 7% para 8%
// subiu 1 ponto, não 14 por cento.
export const formatarPontos = (diferenca: number): string => {
  const pontos = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  }).format(Math.abs(diferenca) * 100);

  if (diferenca > 0) return `+${pontos} p.p.`;
  if (diferenca < 0) return `−${pontos} p.p.`;

  return 'igual';
};

export const taxa = (parte: number, total: number): number =>
  total === 0 ? 0 : parte / total;

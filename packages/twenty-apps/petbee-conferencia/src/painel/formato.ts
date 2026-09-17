// Formatação em português do Brasil, num lugar só.

export const formatarInteiro = (valor: number): string =>
  new Intl.NumberFormat('pt-BR').format(valor);

export const formatarReais = (valor: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);

// Diferença com sinal na frente: "+R$ 10,00" ou "−R$ 10,00". Menos de um
// centavo é "igual", porque é o mesmo corte que a conciliação usa.
export const formatarDiferenca = (valor: number): string => {
  if (Math.abs(valor) < 0.005) return 'igual';

  return `${valor > 0 ? '+' : '−'}${formatarReais(Math.abs(valor))}`;
};

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

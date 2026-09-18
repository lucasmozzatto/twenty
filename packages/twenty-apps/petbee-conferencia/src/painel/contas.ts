// As contas derivadas: os totais de cada lado e a tabela por vendedor.
// Só soma e agrupa; os vereditos vêm prontos da conciliação diária.
import {
  type Assinatura,
  type Venda,
  type VereditoAssinatura,
  type VereditoVenda,
} from 'src/painel/dados';

export type Resumo = {
  vendas: number;
  receita: number;
  // Soma do "Valor no banco" das vendas: o que o banco confirma delas. Venda
  // sem assinatura casada entra com zero, e por isso pesa inteira na diferença.
  valorBanco: number;
  // Receita do CRM menos o valor no banco das mesmas vendas. Zero é o
  // objetivo. É a soma da coluna "Diferença" da lista de vendas; comparar com
  // o MRR de todas as assinaturas misturava assinatura sem venda na conta.
  diferenca: number;
  // Vendas com outro negócio ganho do mesmo cliente no período.
  duplicadas: number;
  // Vendas cujo cliente só tem assinatura cancelada dentro do mês: pela regra
  // do fechamento, deveriam estar em Perdido.
  aCancelar: number;
  // Assinaturas cobradas: fora as de valor zero. É o lado do banco que tem
  // dinheiro.
  assinaturas: number;
  mrr: number;
  cortesias: number;
  canceladas: number;
  // Canceladas dentro do mês em que começaram: não são venda do mês.
  canceladasNoMes: number;
  // "Sem venda" de verdade: fora as canceladas dentro do próprio mês, que só
  // estão assim porque o negócio já foi, corretamente, para Perdido.
  semVenda: number;
  vereditosVenda: Record<VereditoVenda, number>;
  vereditosAssinatura: Record<VereditoAssinatura, number>;
};

export const resumir = (vendas: Venda[], assinaturas: Assinatura[]): Resumo => {
  const vereditosVenda: Record<VereditoVenda, number> = {
    CONFERIDA: 0,
    VALOR_DIVERGENTE: 0,
    SEM_ASSINATURA: 0,
    AGUARDANDO: 0,
  };
  const vereditosAssinatura: Record<VereditoAssinatura, number> = {
    COM_VENDA: 0,
    SEM_VENDA: 0,
    CORTESIA: 0,
    AGUARDANDO: 0,
  };

  let receita = 0;
  let valorBanco = 0;
  let duplicadas = 0;
  let aCancelar = 0;

  for (const venda of vendas) {
    vereditosVenda[venda.veredito] += 1;
    receita += venda.valorCrm ?? 0;
    valorBanco += venda.valorBanco ?? 0;
    if (venda.duplicada) duplicadas += 1;
    if (venda.assinaturaCanceladaNoMes) aCancelar += 1;
  }

  let mrr = 0;
  let cobradas = 0;
  let cortesias = 0;
  let canceladas = 0;
  let canceladasNoMes = 0;
  let semVenda = 0;

  for (const assinatura of assinaturas) {
    vereditosAssinatura[assinatura.veredito] += 1;
    if (assinatura.canceladaNoMes) canceladasNoMes += 1;
    if (assinatura.veredito === 'SEM_VENDA' && !assinatura.canceladaNoMes) {
      semVenda += 1;
    }

    if (assinatura.cortesia) {
      cortesias += 1;
      continue;
    }

    cobradas += 1;
    mrr += assinatura.mrr ?? 0;
    if (assinatura.status === 'CANCELADA') canceladas += 1;
  }

  return {
    vendas: vendas.length,
    receita,
    valorBanco,
    diferenca: receita - valorBanco,
    duplicadas,
    aCancelar,
    assinaturas: cobradas,
    mrr,
    cortesias,
    canceladas,
    canceladasNoMes,
    semVenda,
    vereditosVenda,
    vereditosAssinatura,
  };
};

export type LinhaVendedor = {
  // Id do membro do workspace; null é "Sem dono".
  chave: string | null;
  vendas: number;
  receita: number;
  // Soma do "Valor no banco" das vendas dele: o que o banco confirma.
  valorBanco: number;
  conferidas: number;
  divergentes: number;
  semAssinatura: number;
  aguardando: number;
};

const linhaVazia = (chave: string | null): LinhaVendedor => ({
  chave,
  vendas: 0,
  receita: 0,
  valorBanco: 0,
  conferidas: 0,
  divergentes: 0,
  semAssinatura: 0,
  aguardando: 0,
});

// Por dono ATUAL do negócio, como no Painel Comercial: negócio repassado
// conta para quem está com ele hoje.
export const porVendedor = (vendas: Venda[]): LinhaVendedor[] => {
  const linhas = new Map<string | null, LinhaVendedor>();

  for (const venda of vendas) {
    const linha = linhas.get(venda.vendedorId) ?? linhaVazia(venda.vendedorId);

    linha.vendas += 1;
    linha.receita += venda.valorCrm ?? 0;
    linha.valorBanco += venda.valorBanco ?? 0;

    if (venda.veredito === 'CONFERIDA') linha.conferidas += 1;
    else if (venda.veredito === 'VALOR_DIVERGENTE') linha.divergentes += 1;
    else if (venda.veredito === 'SEM_ASSINATURA') linha.semAssinatura += 1;
    else linha.aguardando += 1;

    linhas.set(venda.vendedorId, linha);
  }

  // Quem mais vendeu primeiro; "Sem dono" sempre no fim, porque não é pessoa.
  return [...linhas.values()].sort((a, b) => {
    if (a.chave === null) return 1;
    if (b.chave === null) return -1;

    return b.receita - a.receita || b.vendas - a.vendas;
  });
};

export const somarLinhas = (linhas: LinhaVendedor[]): LinhaVendedor =>
  linhas.reduce(
    (soma, linha) => ({
      chave: soma.chave,
      vendas: soma.vendas + linha.vendas,
      receita: soma.receita + linha.receita,
      valorBanco: soma.valorBanco + linha.valorBanco,
      conferidas: soma.conferidas + linha.conferidas,
      divergentes: soma.divergentes + linha.divergentes,
      semAssinatura: soma.semAssinatura + linha.semAssinatura,
      aguardando: soma.aguardando + linha.aguardando,
    }),
    linhaVazia('total'),
  );

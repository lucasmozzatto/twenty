// A pergunta do bônus: quanto cada vendedor vendeu no período, e quanto disso
// o banco confirma. Uma tabela, porque sete números por pessoa lidos lado a
// lado dizem mais que sete barras.
import { Cartao } from 'src/painel/cartoes';
import { type LinhaVendedor, somarLinhas } from 'src/painel/contas';
import { formatarInteiro, formatarReais } from 'src/painel/formato';
import { Cabecalho } from 'src/painel/pecas';
import { type Tema } from 'src/painel/tema';

const COLUNAS = [
  'Vendedor',
  'Vendas',
  'Receita CRM',
  'No banco',
  'Conferidas',
  'Divergentes',
  'Sem assinatura',
  'Aguardando',
];

const GRADE =
  'minmax(120px, 1.5fr) minmax(60px, 0.8fr) repeat(2, minmax(100px, 1.2fr)) repeat(4, minmax(80px, 1fr))';

export const TabelaVendedores = ({
  linhas,
  nomes,
  tema,
}: {
  linhas: LinhaVendedor[];
  nomes: Record<string, string>;
  tema: Tema;
}) => {
  const rotulo = (chave: string | null) =>
    chave === null ? 'Sem dono' : (nomes[chave] ?? 'Membro removido');

  const celula = (
    texto: string,
    cor: string,
    negrito = false,
    esquerda = false,
  ) => (
    <div
      style={{
        textAlign: esquerda ? 'left' : 'right',
        color: cor,
        fontWeight: negrito ? 700 : 400,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {texto}
    </div>
  );

  // Zero em cinza: numa linha de pendências, o que importa é o que não é zero.
  const contagem = (valor: number, cor: string, negrito: boolean) =>
    celula(formatarInteiro(valor), valor === 0 ? tema.suave : cor, negrito);

  const fileira = (nome: string, valores: LinhaVendedor, destaque: boolean) => (
    <div
      key={nome}
      style={{
        display: 'grid',
        gridTemplateColumns: GRADE,
        gap: '8px',
        padding: '6px 0',
        borderTop: `1px solid ${tema.borda}`,
        fontSize: '12px',
        fontStyle: valores.chave === null ? 'italic' : 'normal',
      }}
    >
      {celula(nome, valores.chave === null ? tema.suave : tema.texto, destaque, true)}
      {celula(formatarInteiro(valores.vendas), tema.texto, destaque)}
      {celula(formatarReais(valores.receita), tema.verde, destaque)}
      {celula(formatarReais(valores.valorBanco), tema.azul, destaque)}
      {contagem(valores.conferidas, tema.verde, destaque)}
      {contagem(valores.divergentes, tema.vermelho, destaque)}
      {contagem(valores.semAssinatura, tema.laranja, destaque)}
      {contagem(valores.aguardando, tema.suave, destaque)}
    </div>
  );

  return (
    <Cartao
      titulo="Por vendedor, no período"
      nota="Vendas: negócios ganhos pela data de fechamento, pelo dono atual do negócio. Receita CRM: soma do valor deles. No banco: soma do que a conciliação encontrou nas assinaturas desses clientes. As quatro últimas colunas contam vendas por veredito."
      tema={tema}
    >
      {linhas.length === 0 ? (
        <div style={{ fontSize: '12px', color: tema.suave }}>Nada no período.</div>
      ) : (
        <>
          <Cabecalho colunas={COLUNAS} grade={GRADE} tema={tema} />
          {linhas.map((linha) => fileira(rotulo(linha.chave), linha, false))}
          {fileira('Total', somarLinhas(linhas), true)}
        </>
      )}
    </Cartao>
  );
};

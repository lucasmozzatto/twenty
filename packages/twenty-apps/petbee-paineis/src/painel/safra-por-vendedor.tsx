// A pergunta principal do painel: dos leads que a automação entregou a cada
// vendedor, quantos viraram venda. Uma tabela, porque cinco números por pessoa
// lidos lado a lado dizem mais que cinco barras.
import { Cartao } from 'src/painel/cartoes';
import { formatarInteiro, formatarPercentual } from 'src/painel/formato';
import { type SafraPorVendedor as Linha } from 'src/painel/funil';
import { type Tema } from 'src/painel/tema';

const COLUNAS = ['Vendedor', 'Recebidos', 'Ganhos', 'Perdidos', 'Em aberto', 'Taxa'];
const GRADE = 'minmax(120px, 1.6fr) repeat(5, minmax(70px, 1fr))';

export const SafraPorVendedor = ({
  linhas,
  nomes,
  tema,
}: {
  linhas: Linha[];
  nomes: Record<string, string>;
  tema: Tema;
}) => {
  const rotulo = (chave: string | null) =>
    chave === null ? 'Sem dono' : (nomes[chave] ?? 'Membro removido');

  const total = linhas.reduce(
    (soma, linha) => ({
      recebidos: soma.recebidos + linha.recebidos,
      ganhos: soma.ganhos + linha.ganhos,
      perdidos: soma.perdidos + linha.perdidos,
      emAberto: soma.emAberto + linha.emAberto,
    }),
    { recebidos: 0, ganhos: 0, perdidos: 0, emAberto: 0 },
  );

  const celula = (texto: string, cor: string, negrito = false, alinharEsquerda = false) => (
    <div
      style={{
        textAlign: alinharEsquerda ? 'left' : 'right',
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

  const fileira = (
    nome: string,
    valores: Pick<Linha, 'recebidos' | 'ganhos' | 'perdidos' | 'emAberto'>,
    destaque: boolean,
    semDono = false,
  ) => (
    <div
      key={nome}
      style={{
        display: 'grid',
        gridTemplateColumns: GRADE,
        gap: '8px',
        padding: '6px 0',
        borderTop: `1px solid ${tema.borda}`,
        fontSize: '12px',
        fontStyle: semDono ? 'italic' : 'normal',
      }}
    >
      {celula(nome, semDono ? tema.suave : tema.texto, destaque, true)}
      {celula(formatarInteiro(valores.recebidos), tema.texto, destaque)}
      {celula(formatarInteiro(valores.ganhos), tema.verde, destaque)}
      {celula(formatarInteiro(valores.perdidos), tema.vermelho, destaque)}
      {celula(formatarInteiro(valores.emAberto), tema.azul, destaque)}
      {celula(formatarPercentual(valores.ganhos, valores.recebidos), tema.texto, true)}
    </div>
  );

  return (
    <Cartao
      titulo="Por vendedor: dos que entraram em negociação no período, como estão hoje"
      nota="Recebidos = leads que a automação entregou à pessoa. Taxa = ganhos sobre recebidos. Quem está em aberto ainda não é veredito: uma taxa baixa pode ser só falta de tempo."
      tema={tema}
    >
      {linhas.length === 0 ? (
        <div style={{ fontSize: '12px', color: tema.suave }}>
          Ninguém recebeu lead em negociação no período.
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: GRADE,
              gap: '8px',
              paddingBottom: '4px',
              fontSize: '11px',
              color: tema.suave,
            }}
          >
            {COLUNAS.map((coluna, indice) => (
              <div key={coluna} style={{ textAlign: indice === 0 ? 'left' : 'right' }}>
                {coluna}
              </div>
            ))}
          </div>
          {linhas.map((linha) =>
            fileira(rotulo(linha.chave), linha, false, linha.chave === null),
          )}
          {fileira('Total', total, true)}
        </>
      )}
    </Cartao>
  );
};

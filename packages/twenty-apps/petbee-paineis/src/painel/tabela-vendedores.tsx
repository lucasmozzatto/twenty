// A pergunta principal do painel: o que cada vendedor recebeu, fechou e perdeu
// no período, entre os leads que passaram pela mão dele. Uma tabela, porque
// sete números por pessoa lidos lado a lado dizem mais que sete barras.
import { Cartao } from 'src/painel/cartoes';
import {
  type DesfechoPorVendedor,
  type VendaSemClassificacao,
  type VendaSemNegociacao,
} from 'src/painel/desfechos';
import { formatarInteiro, formatarPercentual, formatarReais } from 'src/painel/formato';
import { type RecebidosPorVendedor } from 'src/painel/cohorts';
import { NAO_SAO_VENDEDORES } from 'src/painel/equipe';
import { NotaDeVendas } from 'src/painel/nota-vendas';
import { type Tema } from 'src/painel/tema';

export type LinhaVendedor = {
  chave: string | null;
  recebidos: number;
  emAberto: number;
  ganhos: number;
  perdidos: number;
  receita: number;
  ticketMedio: number | null;
};

// Junta as duas fontes por dono: recebidos e em aberto vêm da Cohort (chegaram
// no vendedor no período, contados uma vez só); ganhos, perdidos, receita e
// ticket vêm dos desfechos. Todo membro do time ganha linha, mesmo zerado: uma
// pessoa que some da tabela num dia parado parece erro, e a lista completa é o
// que permite comparar. Quem não é vendedor (`equipe.ts`) fica de fora dessa
// regra e só aparece se tiver algum número. "Sem dono" só aparece quando tem
// algo.
export const montarLinhas = (
  recebidos: RecebidosPorVendedor[],
  desfechos: DesfechoPorVendedor[],
  membros: string[],
): LinhaVendedor[] => {
  const porDono = new Map<string | null, LinhaVendedor>();
  const linha = (chave: string | null): LinhaVendedor => {
    const existente = porDono.get(chave);

    if (existente !== undefined) return existente;

    const nova = {
      chave,
      recebidos: 0,
      emAberto: 0,
      ganhos: 0,
      perdidos: 0,
      receita: 0,
      ticketMedio: null,
    };

    porDono.set(chave, nova);

    return nova;
  };

  for (const membro of membros) {
    if (!NAO_SAO_VENDEDORES.has(membro)) linha(membro);
  }

  for (const item of recebidos) {
    const alvo = linha(item.chave);

    alvo.recebidos = item.recebidos;
    alvo.emAberto = item.emAberto;
  }

  for (const item of desfechos) {
    const alvo = linha(item.chave);

    alvo.ganhos = item.ganhos;
    alvo.perdidos = item.perdidos;
    alvo.receita = item.receita;
    alvo.ticketMedio = item.ticketMedio;
  }

  // Quem mais fechou primeiro; "Sem dono" sempre no fim, porque não é pessoa.
  return [...porDono.values()].sort((a, b) => {
    if (a.chave === null) return 1;
    if (b.chave === null) return -1;

    return b.ganhos - a.ganhos || b.recebidos - a.recebidos;
  });
};

const COLUNAS = [
  'Vendedor',
  'Recebidos',
  'Ganhos',
  'Perdidos',
  'Em aberto',
  'Taxa',
  'Receita',
  'Ticket médio',
];
const GRADE = 'minmax(110px, 1.4fr) repeat(5, minmax(66px, 1fr)) repeat(2, minmax(96px, 1.2fr))';

export const TabelaVendedores = ({
  linhas,
  nomes,
  semClassificacao,
  semNegociacao,
  truncado,
  tema,
}: {
  linhas: LinhaVendedor[];
  nomes: Record<string, string>;
  semClassificacao: VendaSemClassificacao[];
  semNegociacao: VendaSemNegociacao[];
  truncado: boolean;
  tema: Tema;
}) => {
  const rotulo = (chave: string | null) =>
    chave === null ? 'Sem dono' : (nomes[chave] ?? 'Membro removido');

  const total = linhas.reduce(
    (soma, item) => ({
      recebidos: soma.recebidos + item.recebidos,
      emAberto: soma.emAberto + item.emAberto,
      ganhos: soma.ganhos + item.ganhos,
      perdidos: soma.perdidos + item.perdidos,
      receita: soma.receita + item.receita,
    }),
    { recebidos: 0, emAberto: 0, ganhos: 0, perdidos: 0, receita: 0 },
  );

  const celula = (texto: string, cor: string, negrito = false, esquerda = false) => (
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

  const fileira = (
    nome: string,
    valores: Omit<LinhaVendedor, 'chave'>,
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
      {celula(formatarReais(valores.receita), tema.verde, destaque)}
      {celula(
        valores.ticketMedio === null ? '—' : formatarReais(valores.ticketMedio),
        tema.texto,
        destaque,
      )}
    </div>
  );

  return (
    <Cartao
      titulo="Por vendedor, no período"
      nota='Recebidos: chegaram no vendedor no período (primeira entrada em negociação; quem voltou do Break não conta de novo) mais as vendas contadas cujo lead nunca passou por negociação, no dia da venda. A mesma conta da visão Cohort. Ganhos: vendas do período (data de fechamento) com o campo Fechamento = Comercial, para o dono do card; Direto e Recompra ficam fora; sem o campo, conta só se passou por negociação ou se um vendedor marcou o Ganho à mão. Perdidos: perderam no período, tendo passado por negociação, e continuam em Perdido. Em aberto: recebidos ainda sem desfecho. Taxa: ganhos sobre recebidos, ou seja, vendas do período sobre leads que chegaram no período. Receita e ticket: dos ganhos.'
      tema={tema}
    >
      {truncado ? (
        <div style={{ fontSize: '12px', color: tema.laranja, marginBottom: '8px' }}>
          <b>Atenção:</b> o período tem registros demais para ler de uma vez; estes
          números estão por baixo. Escolha um intervalo menor.
        </div>
      ) : null}
      {linhas.length === 0 ? (
        <div style={{ fontSize: '12px', color: tema.suave }}>Nada no período.</div>
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
          {linhas.map((item) =>
            fileira(rotulo(item.chave), item, false, item.chave === null),
          )}
          {fileira(
            'Total',
            {
              ...total,
              // Ticket do total é receita sobre ganhos, não média das médias.
              ticketMedio: total.ganhos === 0 ? null : total.receita / total.ganhos,
            },
            true,
          )}
        </>
      )}
      <NotaDeVendas
        semClassificacao={semClassificacao}
        semNegociacao={semNegociacao}
        tema={tema}
      />
    </Cartao>
  );
};

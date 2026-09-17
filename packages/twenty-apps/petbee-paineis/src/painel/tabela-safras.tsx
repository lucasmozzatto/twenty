// A tabela de safras do time: uma linha por semana ou mês, e o que virou de
// cada lote de leads entregues aos vendedores.
import { type ReactNode } from 'react';

import { Cartao } from 'src/painel/cartoes';
import {
  formatarInteiro,
  formatarPercentual,
  formatarReais,
} from 'src/painel/formato';
import {
  DIAS_PARA_AMADURECER,
  type LinhaSafra,
  type ResumoDaSafra,
} from 'src/painel/safras';
import { type Tema } from 'src/painel/tema';

const COLUNAS = [
  'Safra',
  'Recebidos',
  'Ganhos',
  'Perdidos',
  'Em aberto',
  'Conversão',
  'Receita',
  'Ticket médio',
  'Até vender',
  'Maturidade',
];
const GRADE =
  'minmax(92px, 1.2fr) repeat(5, minmax(62px, 1fr)) repeat(2, minmax(86px, 1.1fr)) minmax(68px, 1fr) minmax(150px, 1.6fr)';

const formatarDias = (dias: number | null): string =>
  dias === null
    ? '—'
    : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(dias)} d`;

export const TabelaSafras = ({
  linhas,
  total,
  tema,
}: {
  linhas: LinhaSafra[];
  total: ResumoDaSafra;
  tema: Tema;
}) => {
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

  const maturidade = (linha: LinhaSafra) => {
    const decididos = formatarPercentual(
      linha.ganhos + linha.perdidos,
      linha.recebidos,
    );

    if (linha.recebidos === 0) return celula('—', tema.suave);
    if (linha.maturidade === 'madura') return celula('madura', tema.verde, true);
    if (linha.maturidade === 'em-andamento') {
      return celula(`em andamento · ${decididos} decididos`, tema.suave);
    }

    return celula(`${decididos} decididos`, tema.laranja, true);
  };

  const fileira = (
    rotulo: string,
    valores: ResumoDaSafra,
    ultimaColuna: ReactNode,
    destaque: boolean,
    parcial = false,
  ) => (
    <div
      key={rotulo}
      style={{
        display: 'grid',
        gridTemplateColumns: GRADE,
        gap: '8px',
        padding: '6px 0',
        borderTop: `1px solid ${tema.borda}`,
        fontSize: '12px',
      }}
    >
      {celula(parcial ? `${rotulo} (parcial)` : rotulo, parcial ? tema.suave : tema.texto, destaque, true)}
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
      {celula(formatarDias(valores.diasAteVender), tema.texto, destaque)}
      {ultimaColuna}
    </div>
  );

  return (
    <Cartao
      titulo="Safras do time"
      nota={`Cada linha é um lote de leads que chegou nos vendedores naquela semana ou mês, olhado como está hoje. Conversão: ganhos sobre recebidos. "Madura" = fechou há ${DIAS_PARA_AMADURECER} dias ou mais; antes disso o número ainda muda. "Até vender": dias médios entre chegar no vendedor e virar venda.`}
      tema={tema}
    >
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
          {linhas.map((linha) =>
            fileira(linha.rotulo, linha, maturidade(linha), false, linha.parcial),
          )}
          {fileira('Total', total, celula('', tema.suave), true)}
        </>
      )}
    </Cartao>
  );
};
